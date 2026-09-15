import type { Embeddings, ResourceSource } from 'react-native-rag';
import { TextEmbeddingsModule } from 'react-native-executorch';
import {
  EMBEDDING_DOCUMENT_PREFIX,
  EMBEDDING_QUERY_PREFIX,
} from '../constants/embedding-model';
import { truncateToTokenBudget } from './textChunking';

interface LFMEmbeddingsParams {
  modelSource: ResourceSource;
  tokenizerSource: ResourceSource;
  onDownloadProgress?: (progress: number) => void;
}

const ignoreOutcome = () => undefined;
const ignoreProgress = () => {};

export class LFMEmbeddings implements Embeddings {
  private module: TextEmbeddingsModule | null = null;
  private operationChain: Promise<void> = Promise.resolve();
  private readonly modelSource: ResourceSource;
  private readonly tokenizerSource: ResourceSource;
  private readonly onDownloadProgress: (progress: number) => void;

  constructor({
    modelSource,
    tokenizerSource,
    onDownloadProgress = ignoreProgress,
  }: LFMEmbeddingsParams) {
    this.modelSource = modelSource;
    this.tokenizerSource = tokenizerSource;
    this.onDownloadProgress = onDownloadProgress;
  }

  async load(): Promise<this> {
    if (!this.module) {
      this.module = await TextEmbeddingsModule.fromCustomModel(
        this.modelSource,
        this.tokenizerSource,
        this.onDownloadProgress
      );
    }
    return this;
  }

  async unload(): Promise<void> {
    this.module?.delete();
    this.module = null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.module) {
      throw new Error('TextEmbeddingsModule not loaded. Call load() first.');
    }
    return Array.from(await this.module.forward(text));
  }

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
