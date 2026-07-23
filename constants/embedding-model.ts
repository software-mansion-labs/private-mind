export interface ModelSourceConfig {
  decoderSource?: string;
  encoderSource?: string;
  tokenizerSource?: string;
  modelSource?: string;
}

const LFM_2_5_EMBEDDING_HF_BASE =
  'https://huggingface.co/software-mansion/react-native-executorch-lfm2.5-embedding-350m/resolve/main';

export const LFM_2_5_EMBEDDING_MODEL_FILE =
  'lfm_2_5_embedding_350m_xnnpack_8da4w.pte';

export const LFM_2_5_EMBEDDING_MODEL_ID = 'lfm-2-5';

export const LFM_2_5_EMBEDDING_SOURCES: ModelSourceConfig = {
  modelSource: `${LFM_2_5_EMBEDDING_HF_BASE}/xnnpack/${LFM_2_5_EMBEDDING_MODEL_FILE}`,
  tokenizerSource: `${LFM_2_5_EMBEDDING_HF_BASE}/tokenizer.json`,
};

const LFM_2_5_EMBEDDING_MODEL_BYTES = 430_609_152;
const LFM_2_5_EMBEDDING_TOKENIZER_BYTES = 4_733_275;

export const LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES =
  LFM_2_5_EMBEDDING_MODEL_BYTES + LFM_2_5_EMBEDDING_TOKENIZER_BYTES;

export const LFM_2_5_EMBEDDING_DIM = 1024;

export const EMBEDDING_QUERY_PREFIX = 'query: ';
export const EMBEDDING_DOCUMENT_PREFIX = 'document: ';

export const ACTIVE_EMBEDDING_MODEL_KEY = 'active_embedding_model_id';
