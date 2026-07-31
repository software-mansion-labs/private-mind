import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import {
  EMBEDDING_DOCUMENT_PREFIX,
  EMBEDDING_QUERY_PREFIX,
} from '../constants/embedding-model';
import { truncateToTokenBudget } from './textChunking';

export class LFMEmbeddings extends ExecuTorchEmbeddings {
  embedQuery(text: string): Promise<number[]> {
    return this.embed(
      truncateToTokenBudget(`${EMBEDDING_QUERY_PREFIX}${text}`)
    );
  }

  embedDocument(text: string): Promise<number[]> {
    return this.embed(
      truncateToTokenBudget(`${EMBEDDING_DOCUMENT_PREFIX}${text}`)
    );
  }
}
