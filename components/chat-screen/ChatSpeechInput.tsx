import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Theme, isDarkTheme } from '../../styles/colors';
import LoadingBorder from './LoadingBorder';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontSizes, lineHeights } from '../../styles/fontStyles';
import {
  AUDIO_LENGTH_SECONDS,
  SAMPLE_RATE,
  useSpeechInput,
  type Status,
} from '../../hooks/useSpeechInput';
import CircleButton from '../CircleButton';
import StopIcon from '../../assets/icons/pause_icon.svg';
import ComposerActionButton from './ComposerActionButton';
import { composerControlColors } from './composerControl';
import VoiceDome, {
  type VoiceDomeHandle,
  type VoiceDomePhase,
} from '../swarm/VoiceDome';
import {
  VOICE_DOME_PALETTE,
  VOICE_DOME_PALETTE_CANCELLED,
  VOICE_DOME_PALETTE_ON_LIGHT,
} from '../swarm/voiceDomeShader';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import {
  isOutOfSpaceError,
  shortfallBehind,
  showNotEnoughStorage,
} from '../../utils/storageSpace';
import { whisperDownloadSizeBytes } from '../../utils/sttModelFiles';
import { useSTTStore } from '../../store/sttStore';
import { useStableCallback } from '../../hooks/useStableCallback';
import { dimmedOpacity } from '../../styles/pressable';
import { space } from '../../constants/design-system';
import { withoutNonSpeechNotes } from '../../utils/whisperTranscript';
import { COMPOSER_CARD_RADIUS } from './attachments/constants';

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onInterrupted?: (heard: string) => void;
}

const CANCEL_ANIMATION_DURATION = 500;
const CANCEL_FADE_MS = 150;
const CANCELLED_TRANSCRIPT_OPACITY = 0.45;
const LOADING_BORDER_ON_LIGHT = ['#3D61D6', '#8B5CF6', '#E0559B'] as const;
const LOADING_BORDER_ON_DARK = ['#6FE7FF', '#B48CFF', '#FF7FCF'] as const;

type Phase = Status | 'ended';

const ACTION_NOTES: Record<Exclude<Phase, 'listening'>, string> = {
  loading: 'Loading speech recognition...',
  idle: 'Loading speech recognition...',
  processing: 'Finishing the transcript...',
  ended: 'Dictation stopped',
};

const DOME_HEIGHT = 80;
const DOME_MAX_RISE = 28;

const shownTranscript = (committed: string, nonCommitted: string) =>
  withoutNonSpeechNotes(committed + ' ' + nonCommitted);

const ChatSpeechInput: React.FC<Props> = ({
  onSubmit: onSubmitProp,
  onCancel: onCancelProp,
  onInterrupted: onInterruptedProp,
}) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const recordingAttemptedRef = useRef(false);
  const recordingStartTimeRef = useRef(0);
  /** in seconds */
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcription, setTranscription] = useState<{
    committed: string;
    nonCommitted: string;
  }>({ committed: '', nonCommitted: '' });

  const heardSoFarRef = useRef({ committed: '', nonCommitted: '' });

  const domeRef = useRef<VoiceDomeHandle>(null);
  const exitStateRef = useRef<
    null | 'pending_submit' | 'pending_cancel' | 'exited'
  >(null);

  const onSubmit = useStableCallback((result: string) => {
    if (exitStateRef.current === 'exited') return;
    exitStateRef.current = 'exited';
    onSubmitProp(result);
  });
  const onCancel = useStableCallback(() => {
    if (exitStateRef.current === 'exited') return;
    exitStateRef.current = 'exited';
    onCancelProp();
  });

  const { loadProgress, isDownloading, status, start, stop, abandon } =
    useSpeechInput({
      onAudioData: (data) => {
        setRecordingDuration(
          Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        );
        domeRef.current?.pushChunk(data);
      },
    });

  const [hasStarted, setHasStarted] = useState(false);
  const unmountedRef = useRef(false);
  const abandonRef = useRef(abandon);
  abandonRef.current = abandon;
  useEffect(() => {
    const startListening = async () => {
      try {
        const streamGenerator = await start();
        if (!streamGenerator) {
          if (!unmountedRef.current) onCancel();
          return;
        }

        recordingStartTimeRef.current = Date.now();
        let text = '';
        let pendingText = '';
        for await (const { committed, nonCommitted } of streamGenerator) {
          if (unmountedRef.current) break;
          text = committed;
          pendingText = nonCommitted;
          heardSoFarRef.current = {
            committed: text,
            nonCommitted: pendingText,
          };
          setTranscription(heardSoFarRef.current);
        }

        if (unmountedRef.current) return;

        if (exitStateRef.current === 'pending_submit') {
          const shown = shownTranscript(text, pendingText);
          if (shown) {
            onSubmit(shown);
          } else {
            Toast.show({ type: 'defaultToast', text1: 'No speech was heard.' });
            onCancel();
          }
        } else if (exitStateRef.current === null) {
          onEndedEarly(shownTranscript(text, pendingText));
        }
      } catch (error) {
        if (unmountedRef.current) return;
        console.error('Live transcript could not start', error);
        if (isOutOfSpaceError(error)) {
          showNotEnoughStorage(
            'Voice dictation',
            shortfallBehind(
              error,
              whisperDownloadSizeBytes(useSTTStore.getState().requestedKind)
            )
          );
        } else {
          Toast.show({
            type: 'defaultToast',
            text1: 'Could not start live transcript',
          });
        }
        onCancel();
        return;
      }
    };

    if (!recordingAttemptedRef.current) {
      recordingAttemptedRef.current = true;
      setHasStarted(true);
      startListening();
    }

    return () => {
      unmountedRef.current = true;
      abandonRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInterrupted = useStableCallback((heard: string) => {
    if (onInterruptedProp) onInterruptedProp(heard);
    else onCancelProp();
  });
  const onEndedEarly = useStableCallback((heard: string) => {
    if (heard) {
      exitStateRef.current = 'exited';
      onInterrupted(heard);
      return;
    }
    onCancel();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background' || exitStateRef.current !== null) return;
      exitStateRef.current = 'exited';
      const { committed, nonCommitted } = heardSoFarRef.current;
      abandonRef.current();
      onInterrupted(shownTranscript(committed, nonCommitted));
    });
    return () => subscription.remove();
  }, [onInterrupted]);

  const cancelAnimationProgress = useSharedValue(0);
  const transcriptStyle = useAnimatedStyle(() => ({
    opacity:
      1 - (1 - CANCELLED_TRANSCRIPT_OPACITY) * cancelAnimationProgress.get(),
  }));

  const [cancelling, setCancelling] = useState(false);
  const handleCancel = () => {
    if (exitStateRef.current === null) exitStateRef.current = 'pending_cancel';
    setCancelling(true);
    stop();
    cancelAnimationProgress.set(
      withTiming(1, {
        duration: CANCEL_FADE_MS,
      })
    );

    setTimeout(onCancel, CANCEL_ANIMATION_DURATION);
  };

  const [sending, setSending] = useState(false);
  const phase: Phase = hasStarted && status === 'idle' ? 'ended' : status;
  const isPreparing = phase === 'loading' || phase === 'idle';

  const handleSend = async () => {
    if (isPreparing) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Still loading speech recognition, one moment.',
      });
      return;
    }
    if (phase !== 'listening' || sending) return;

    exitStateRef.current = 'pending_submit';
    setSending(true);
    if (await stop()) return;
    exitStateRef.current = null;
    setSending(false);
  };

  const domePhase: VoiceDomePhase =
    cancelling || phase === 'ended'
      ? 'leaving'
      : phase === 'processing' || sending
        ? 'processing'
        : phase === 'listening'
          ? 'listening'
          : 'waiting';

  const renderTopNote = () => {
    const fullTranscription = shownTranscript(
      transcription.committed,
      transcription.nonCommitted
    );

    if (fullTranscription) {
      return <ScrollableTranscript text={fullTranscription} />;
    }

    if (status === 'listening') {
      return (
        <Text style={styles.secondaryNote}>
          Start talking to see the live transcript...
        </Text>
      );
    }

    if (status === 'processing') {
      return <Text style={styles.secondaryNote}>Processing...</Text>;
    }

    if (phase === 'ended') return null;

    const progressPercentage = Math.round(loadProgress * 100);
    if (status === 'loading' && isDownloading) {
      return (
        <Text style={styles.secondaryNote}>
          Downloading the dictation model ({progressPercentage}%)
        </Text>
      );
    }
    return (
      <Text style={styles.secondaryNote}>
        Loading...{status === 'loading' ? ` (${progressPercentage}%)` : ''}
      </Text>
    );
  };

  return (
    <View style={styles.fill}>
      <View style={[styles.fill, styles.container]}>
        <LoadingBorder
          active={isPreparing && !cancelling}
          radius={COMPOSER_CARD_RADIUS}
          colors={
            isDarkTheme(theme)
              ? LOADING_BORDER_ON_DARK
              : LOADING_BORDER_ON_LIGHT
          }
        />
        <View pointerEvents="none" style={styles.dome}>
          <VoiceDome
            ref={domeRef}
            phase={domePhase}
            sampleRate={SAMPLE_RATE}
            chunkSeconds={AUDIO_LENGTH_SECONDS}
            cornerRadius={COMPOSER_CARD_RADIUS}
            maxHeight={DOME_MAX_RISE}
            palette={
              cancelling
                ? VOICE_DOME_PALETTE_CANCELLED
                : isDarkTheme(theme)
                  ? VOICE_DOME_PALETTE
                  : VOICE_DOME_PALETTE_ON_LIGHT
            }
          />
        </View>
        <Animated.View style={transcriptStyle}>{renderTopNote()}</Animated.View>

        <View style={styles.actionRow}>
          <CircleButton
            icon={StopIcon}
            onPress={handleCancel}
            size={13}
            {...composerControlColors(theme)}
            color={theme.text.onChatBar}
            testID="speech-cancel"
          />
          <View style={styles.actionNote}>
            {cancelling ? (
              <Text style={[styles.secondaryNote, styles.cancelledNote]}>
                Cancelled
              </Text>
            ) : phase === 'listening' ? (
              <RecordingInfo duration={recordingDuration} />
            ) : (
              <Text style={styles.secondaryNote}>{ACTION_NOTES[phase]}</Text>
            )}
          </View>
          <View
            style={
              status === 'listening' || sending ? undefined : dimmedOpacity
            }
          >
            <ComposerActionButton
              action="send"
              onPress={handleSend}
              busy={sending}
              disabled={sending}
              testID="speech-send"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default ChatSpeechInput;

const RecordingInfo: React.FC<{
  /** in seconds */
  duration: number;
}> = ({ duration }) => {
  const { styles } = useThemedStyles(createStyles);

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <View style={styles.recordingInfo}>
      <View style={styles.recordingDot} />
      <Text style={styles.note}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
};

const ScrollableTranscript: React.FC<{ text: string }> = ({ text }) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <ScrollView style={styles.transcriptWrapper}>
      <View style={styles.transcriptContent}>
        <Text style={styles.note}>{text}</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fill: {
      flexGrow: 1,
    },
    container: {
      justifyContent: 'space-between',
      borderRadius: COMPOSER_CARD_RADIUS,
      padding: space.four,
      gap: space.three,
      overflow: 'hidden',
    },
    dome: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: DOME_HEIGHT,
    },

    note: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.onChatBar,
    },
    secondaryNote: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.onChatBarMuted,
    },
    cancelledNote: {
      color: theme.text.onChatBar,
    },

    recordingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    recordingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.bg.errorPrimary,
    },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    actionNote: {
      flex: 1,
      alignItems: 'center',
    },

    transcriptWrapper: {
      maxHeight: lineHeights.xs * 3,
      transform: [{ scaleY: -1 }],
    },
    transcriptContent: {
      transform: [{ scaleY: -1 }],
    },
  });
