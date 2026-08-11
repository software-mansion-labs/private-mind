import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { removeBundledModelLeftovers } from '../utils/bundledModelCleanup';

const RNE_DIR = 'file:///data/Documents/react-native-executorch/';

const MINILM_MODEL = `${RNE_DIR}localhost_8081_assets__unstable_path_._2Fassets_2Fmodels_2Fall-mini-lm_all-MiniLM-L6-v2_xnnpack.pte`;
const MINILM_BUNDLED_MODEL = `${RNE_DIR}all-MiniLM-L6-v2_xnnpack.pte`;
const MINILM_TOKENIZER = `${RNE_DIR}3037831014.json`;
const EMBEDDING_MODEL = `${RNE_DIR}huggingface.co_software-mansion_react-native-executorch-lfm2.5-embedding-350m_resolve_main_xnnpack_lfm_2_5_embedding_350m_xnnpack_8da4w.pte`;
const LLM_MODEL = `${RNE_DIR}huggingface.co_software-mansion_react-native-executorch-qwen-3_resolve_v0.9.0_1_7b_xnnpack_qwen_3_1_7b_xnnpack_8da4w.pte`;
const LLM_TOKENIZER = `${RNE_DIR}huggingface.co_software-mansion_react-native-executorch-qwen-3_resolve_v0.9.0_tokenizer.json`;

const mockList = ExpoResourceFetcher.listDownloadedFiles as jest.Mock;
const mockFile = File as unknown as jest.Mock;

const deletedFiles = () =>
  mockFile.mock.results
    .filter((result) => result.value.delete.mock?.calls.length)
    .map((result) => result.value.uri);

describe('removeBundledModelLeftovers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockList.mockReset();
    mockList.mockResolvedValue([]);
    await AsyncStorage.clear();
  });

  it('removes the leftover MiniLM files and nothing else', async () => {
    mockList.mockResolvedValueOnce([
      MINILM_MODEL,
      MINILM_BUNDLED_MODEL,
      MINILM_TOKENIZER,
      EMBEDDING_MODEL,
      LLM_MODEL,
      LLM_TOKENIZER,
    ]);

    const removed = await removeBundledModelLeftovers();

    expect(removed).toBe(3);
    expect(deletedFiles()).toEqual([
      MINILM_MODEL,
      MINILM_BUNDLED_MODEL,
      MINILM_TOKENIZER,
    ]);
  });

  it('removes a renamed MiniLM model by its size', async () => {
    const renamed = `${RNE_DIR}9f4c1a2b_xnnpack.pte`;
    mockList.mockResolvedValueOnce([renamed, LLM_MODEL]);
    mockFile.mockImplementationOnce(() => ({
      uri: renamed,
      size: 90992000,
      delete: jest.fn(),
    }));

    expect(await removeBundledModelLeftovers()).toBe(1);
    expect(deletedFiles()).toEqual([renamed]);
  });

  it('runs only once', async () => {
    mockList.mockResolvedValueOnce([MINILM_MODEL]);
    expect(await removeBundledModelLeftovers()).toBe(1);

    mockList.mockResolvedValueOnce([MINILM_MODEL]);
    expect(await removeBundledModelLeftovers()).toBe(0);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('retries on the next launch when the files cannot be listed', async () => {
    mockList.mockRejectedValueOnce(new Error('directory does not exist'));

    expect(await removeBundledModelLeftovers()).toBe(0);
    expect(await AsyncStorage.getItem('bundled_model_leftovers_removed')).toBe(
      null
    );
  });

  it('keeps going when a single file cannot be deleted', async () => {
    mockList.mockResolvedValueOnce([MINILM_MODEL, MINILM_TOKENIZER]);
    mockFile.mockImplementationOnce(() => ({
      uri: MINILM_MODEL,
      delete: () => {
        throw new Error('EPERM');
      },
    }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await removeBundledModelLeftovers()).toBe(1);
    expect(deletedFiles()).toEqual([MINILM_TOKENIZER]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
