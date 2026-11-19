import type { Embeddings, ResourceSource } from 'react-native-rag';
import { createTextEmbedder, type TextEmbedder } from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import {
  EMBEDDING_DOCUMENT_PREFIX,
  EMBEDDING_QUERY_PREFIX,
} from '../constants/embedding-model';
import { truncateToTokenBudget } from './textChunking';
import { preferDownloadedCopy } from './downloadedCopy';
import { toLocalPath } from './localPath';

interface LFMEmbeddingsParams {
  modelSource: ResourceSource;
  tokenizerSource: ResourceSource;
  onDownloadProgress?: (progress: number) => void;
}

const ignoreOutcome = () => undefined;
const ignoreProgress = () => {};

const isLocal = (source: unknown): source is string =>
  typeof source === 'string' && !/^https?:\/\//.test(source);

export class LFMEmbeddings implements Embeddings {
  private embedder: TextEmbedder | null = null;
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

  private async localFiles(): Promise<[string, string]> {
    const model = preferDownloadedCopy(this.modelSource);
    const tokenizer = preferDownloadedCopy(this.tokenizerSource);
    if (isLocal(model) && isLocal(tokenizer)) return [model, tokenizer];
    const paths = await ResourceFetcher.fetch(
      this.onDownloadProgress,
      model,
      tokenizer
    );
    if (!paths || paths.length < 2) {
      throw new Error('The embedding model download did not finish.');
    }
    return [paths[0], paths[1]];
  }

  async load(): Promise<this> {
    if (!this.embedder) {
      const [modelPath, tokenizerPath] = await this.localFiles();
      this.embedder = await createTextEmbedder({
        modelPath: toLocalPath(modelPath),
        tokenizerPath: toLocalPath(tokenizerPath),
      });
    }
    return this;
  }

  async unload(): Promise<void> {
    this.embedder?.dispose();
    this.embedder = null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('The embedding model is not loaded. Call load() first.');
    }
    return Array.from(await this.embedder.embed(text));
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
