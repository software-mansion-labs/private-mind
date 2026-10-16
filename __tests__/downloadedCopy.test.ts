import { TextEmbeddingsModule } from 'react-native-executorch/legacy';
import { existingFiles } from '../__mocks__/expo-file-system';
import {
  downloadedCopyUri,
  downloadsDirectoryUri,
  preferDownloadedCopy,
} from '../utils/downloadedCopy';
import { LFMEmbeddings } from '../utils/lfmEmbeddings';

const MODEL_URL =
  'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-1B/QLoRA/llama3_2_qat_lora.pte';
const MODEL_FILE_URI =
  'file:///documents/react-native-executorch/huggingface.co_software-mansion_react-native-executorch-llama-3.2_resolve_v0.4.0_llama-3.2-1B_QLoRA_llama3_2_qat_lora.pte';

const mockFromCustomModel = TextEmbeddingsModule.fromCustomModel as jest.Mock;

beforeEach(() => {
  existingFiles.clear();
  mockFromCustomModel.mockReset();
  mockFromCustomModel.mockResolvedValue({ delete: jest.fn() });
});

describe('downloadedCopyUri', () => {
  it('lives in the directory the resource fetcher downloads into', () => {
    const { RNEDirectory } = jest.requireActual(
      '../node_modules/react-native-executorch-expo-resource-fetcher/lib/constants/directories'
    );
    expect(downloadsDirectoryUri()).toBe(RNEDirectory);
  });

  it('names the file the way the resource fetcher saves a remote url', () => {
    expect(downloadedCopyUri(MODEL_URL)).toBe(MODEL_FILE_URI);
  });

  it('ignores the backend fragment, like the resource fetcher', () => {
    expect(downloadedCopyUri(`${MODEL_URL}#mlx`)).toBe(MODEL_FILE_URI);
  });
});

describe('preferDownloadedCopy', () => {
  it('swaps a remote url for its file once the file is on disk', () => {
    existingFiles.add(MODEL_FILE_URI);
    expect(preferDownloadedCopy(MODEL_URL)).toBe(MODEL_FILE_URI);
  });

  it('keeps the url when the file is missing', () => {
    expect(preferDownloadedCopy(MODEL_URL)).toBe(MODEL_URL);
  });

  it('leaves local files and bundled assets untouched', () => {
    expect(preferDownloadedCopy('file:///models/custom.pte')).toBe(
      'file:///models/custom.pte'
    );
    expect(preferDownloadedCopy(42)).toBe(42);
  });
});

describe('LFMEmbeddings.load', () => {
  const TOKENIZER_URL = 'https://example.com/embedding/tokenizer.json';
  const TOKENIZER_FILE_URI =
    'file:///documents/react-native-executorch/example.com_embedding_tokenizer.json';

  it('loads a downloaded embedding model from disk without the network', async () => {
    existingFiles.add(MODEL_FILE_URI);
    existingFiles.add(TOKENIZER_FILE_URI);

    await new LFMEmbeddings({
      modelSource: MODEL_URL,
      tokenizerSource: TOKENIZER_URL,
    }).load();

    expect(mockFromCustomModel).toHaveBeenCalledWith(
      MODEL_FILE_URI,
      TOKENIZER_FILE_URI,
      expect.any(Function)
    );
  });

  it('hands the urls over when the embedding model is not downloaded', async () => {
    await new LFMEmbeddings({
      modelSource: MODEL_URL,
      tokenizerSource: TOKENIZER_URL,
    }).load();

    expect(mockFromCustomModel).toHaveBeenCalledWith(
      MODEL_URL,
      TOKENIZER_URL,
      expect.any(Function)
    );
  });
});
