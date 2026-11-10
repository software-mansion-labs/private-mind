import { Platform } from 'react-native';
import { models, type WhisperSttModel } from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { toLocalPath } from './localPath';

const TINY_ENGLISH_WHISPER = models.speechToText.WHISPER.EN.TINY;

export const whisperModel = (): WhisperSttModel<'en'> =>
  Platform.OS === 'ios'
    ? TINY_ENGLISH_WHISPER.COREML_FP16
    : TINY_ENGLISH_WHISPER.XNNPACK_FP32;

export const whisperSources = (): string[] => {
  const model = whisperModel();
  return [model.modelPath, model.tokenizerPath, model.vadModel.modelPath];
};

export const localWhisperModel = async (
  onProgress: (progress: number) => void
): Promise<WhisperSttModel<'en'>> => {
  const model = whisperModel();
  const paths = await ResourceFetcher.fetch(onProgress, ...whisperSources());
  if (!paths || paths.length < 3) {
    throw new Error('The dictation model download did not finish.');
  }
  const [modelPath, tokenizerPath, vadPath] = paths.map(toLocalPath);
  return {
    ...model,
    modelPath,
    tokenizerPath,
    vadModel: { ...model.vadModel, modelPath: vadPath },
  };
};
