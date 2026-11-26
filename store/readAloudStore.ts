import { AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { AudioManager } from 'react-native-audio-api';
import {
  createReverbTextToSpeech,
  type ReverbDefaultVoiceName,
  type ReverbTextToSpeech,
} from 'react-native-executorch';
import { create } from 'zustand';
import { useLLMStore } from './llmStore';
import { pauseModelDownloadsWhile } from './modelStore';
import { useSTTStore } from './sttStore';
import { createPcmPlayer, type PcmPlayer } from '../utils/pcmPlayer';
import {
  cancelReadAloudFetch,
  isReadAloudDownloaded,
  localReadAloudModel,
  readAloudDownloadBytes,
} from '../utils/readAloudModelFiles';
import type { ReadAloudPlan } from '../utils/readAloudPlan';
import {
  isOutOfSpaceError,
  shortfallBehind,
  showNotEnoughStorage,
} from '../utils/storageSpace';
import {
  READ_ALOUD_MODEL_FILES_LABEL,
  READ_ALOUD_PROGRESS_INTERVAL_MS,
} from '../constants/read-aloud';

export type ReadAloudPhase = 'idle' | 'downloading' | 'preparing' | 'speaking';

export const READ_ALOUD_FAILED_MESSAGE =
  'Could not read this answer aloud. Try again.';

export const readAloudBlockedByModel = (
  llm: ReturnType<typeof useLLMStore.getState>
): boolean =>
  llm.isGenerating ||
  llm.isProcessingPrompt ||
  llm.isBenchmarking ||
  llm.isLoading;

export interface ReadAloudStore {
  messageId: number | null;
  phase: ReadAloudPhase;
  downloadProgress: number;
  toggle: (messageId: number, plan: ReadAloudPlan) => Promise<void>;
  stop: () => Promise<void>;
}

interface Session {
  messageId: number;
  plan: ReadAloudPlan;
  cancelled: boolean;
  fetching: boolean;
  player: PcmPlayer | null;
  module: ReverbTextToSpeech<ReverbDefaultVoiceName> | null;
  audioClaim: number;
}

const IDLE_STATE = {
  messageId: null,
  phase: 'idle' as ReadAloudPhase,
  downloadProgress: 0,
};

export const useReadAloudStore = create<ReadAloudStore>((set) => {
  let current: Session | null = null;
  let windingDown: Promise<void> = Promise.resolve();

  const isCurrent = (session: Session) => current === session;

  const cancel = (session: Session): Promise<void> => {
    if (session.cancelled) return windingDown;
    session.cancelled = true;
    if (isCurrent(session)) {
      current = null;
      set(IDLE_STATE);
    }
    session.player?.stop();
    try {
      session.module?.synthesizeStop();
    } catch (error) {
      console.warn('Could not stop the read-aloud synthesis', error);
    }
    if (session.fetching) {
      cancelReadAloudFetch(session.plan.voice, () => session.fetching);
    }
    return windingDown;
  };

  const report = (session: Session, error: unknown) => {
    if (session.cancelled) return;
    console.warn('Read aloud failed', error);
    if (isOutOfSpaceError(error)) {
      showNotEnoughStorage(
        READ_ALOUD_MODEL_FILES_LABEL,
        shortfallBehind(error, readAloudDownloadBytes())
      );
      return;
    }
    Toast.show({ type: 'defaultToast', text1: READ_ALOUD_FAILED_MESSAGE });
  };

  const fetchModel = async (session: Session) => {
    const { voice } = session.plan;
    const downloaded = await isReadAloudDownloaded(voice);
    if (session.cancelled) return null;

    let lastPublishedAt = 0;
    const publish = (progress: number) => {
      if (session.cancelled) return;
      const now = Date.now();
      if (now - lastPublishedAt < READ_ALOUD_PROGRESS_INTERVAL_MS) return;
      lastPublishedAt = now;
      set({ downloadProgress: progress });
    };

    const load = () => localReadAloudModel(voice, publish);
    session.fetching = true;
    try {
      if (downloaded) return await load();
      set({ phase: 'downloading', downloadProgress: 0 });
      return await pauseModelDownloadsWhile(load);
    } finally {
      session.fetching = false;
    }
  };

  const speak = async (session: Session) => {
    const { text, language, voice } = session.plan;

    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'spokenAudio',
    });
    await AudioManager.setAudioSessionActivity(true);
    if (session.cancelled) return;

    const files = await fetchModel(session);
    if (!files || session.cancelled) return;

    set({ phase: 'preparing' });
    session.module = await createReverbTextToSpeech(files);
    if (session.cancelled) return;

    let announced = false;
    for await (const chunk of session.module.synthesize(text, {
      voice,
      language,
    })) {
      if (session.cancelled) break;
      session.player ??= createPcmPlayer(chunk.sampleRate);
      session.player.enqueue(chunk.audio);
      if (announced) continue;
      announced = true;
      set({ phase: 'speaking' });
    }
    if (session.cancelled) return;
    await session.player?.finish();
  };

  const watchForInterruptions = (session: Session) => {
    const interrupt = () => {
      cancel(session);
    };

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') interrupt();
    });
    const llm = useLLMStore.subscribe((state) => {
      if (readAloudBlockedByModel(state)) interrupt();
    });
    const stt = useSTTStore.subscribe((state) => {
      if (state.audioSessionOwner !== session.audioClaim) interrupt();
    });
    return () => {
      appState.remove();
      llm();
      stt();
    };
  };

  const run = async (session: Session) => {
    const unwatch = watchForInterruptions(session);
    try {
      await speak(session);
    } catch (error) {
      report(session, error);
    } finally {
      unwatch();
      await session.player?.stop();
      try {
        session.module?.dispose();
      } catch (error) {
        console.warn('Could not release the read-aloud model', error);
      }
      if (useSTTStore.getState().audioSessionOwner === session.audioClaim) {
        await AudioManager.setAudioSessionActivity(false).catch(() => {});
      }
      if (isCurrent(session)) {
        current = null;
        set(IDLE_STATE);
      }
    }
  };

  return {
    ...IDLE_STATE,

    stop: async () => {
      if (current) await cancel(current);
      await windingDown;
    },

    toggle: async (messageId, plan) => {
      const speaking = current;
      if (speaking?.messageId === messageId) {
        await cancel(speaking);
        return;
      }
      if (speaking) cancel(speaking);
      if (readAloudBlockedByModel(useLLMStore.getState())) return;

      const previous = windingDown;
      const session: Session = {
        messageId,
        plan,
        cancelled: false,
        fetching: false,
        player: null,
        module: null,
        audioClaim: useSTTStore.getState().claimAudioSession(),
      };
      current = session;
      set({ messageId, phase: 'preparing', downloadProgress: 0 });

      windingDown = previous.then(() => {
        if (session.cancelled) return;
        return run(session);
      });
      const thisRun = windingDown;
      await thisRun;
    },
  };
});
