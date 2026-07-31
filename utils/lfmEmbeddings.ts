import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import {
  EMBEDDING_DOCUMENT_PREFIX,
  EMBEDDING_QUERY_PREFIX,
} from '../constants/embedding-model';
import { truncateToTokenBudget } from './textChunking';

const ignoreOutcome = () => undefined;

export class LFMEmbeddings extends ExecuTorchEmbeddings {
  private operationChain: Promise<void> = Promise.resolve();

  runWithLoadedModel<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationChain.then(async () => {
      try {
        await this.load();
        return await operation();
      } finally {
        await this.unload();
      }
    });

    this.operationChain = result.then(ignoreOutcome, ignoreOutcome);

    return result;
  }

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
