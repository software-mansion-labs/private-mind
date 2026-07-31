import { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { estimatePromptTokens } from '../constants/context-window';
import { EMBEDDING_CHUNK_TOKEN_BUDGET } from '../constants/retrieval';

const makeEmbeddings = () =>
  new LFMEmbeddings({
    modelSource: 'file://embedding-model.pte',
    tokenizerSource: 'file://tokenizer.json',
  });

describe('LFMEmbeddings.runWithLoadedModel', () => {
  it('loads for an operation and always unloads afterwards', async () => {
    const embeddings = makeEmbeddings();
    const load = jest.spyOn(embeddings, 'load').mockResolvedValue(embeddings);
    const unload = jest.spyOn(embeddings, 'unload').mockResolvedValue();
    const operation = jest.fn().mockResolvedValue('result');

    await expect(embeddings.runWithLoadedModel(operation)).resolves.toBe(
      'result'
    );
    expect(load).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(unload).toHaveBeenCalledTimes(1);
    expect(load.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0]
    );
    expect(operation.mock.invocationCallOrder[0]).toBeLessThan(
      unload.mock.invocationCallOrder[0]
    );
  });

  it('unloads when the operation fails', async () => {
    const embeddings = makeEmbeddings();
    jest.spyOn(embeddings, 'load').mockResolvedValue(embeddings);
    const unload = jest.spyOn(embeddings, 'unload').mockResolvedValue();

    await expect(
      embeddings.runWithLoadedModel(async () => {
        throw new Error('embedding failed');
      })
    ).rejects.toThrow('embedding failed');
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('serializes operations so one cannot unload another model session', async () => {
    const embeddings = makeEmbeddings();
    const load = jest.spyOn(embeddings, 'load').mockResolvedValue(embeddings);
    const unload = jest.spyOn(embeddings, 'unload').mockResolvedValue();
    let finishFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const order: string[] = [];

    const first = embeddings.runWithLoadedModel(async () => {
      order.push('first-start');
      markFirstStarted();
      await firstGate;
      order.push('first-end');
    });
    const second = embeddings.runWithLoadedModel(async () => {
      order.push('second');
    });

    await firstStarted;
    expect(order).toEqual(['first-start']);

    finishFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second']);
    expect(load).toHaveBeenCalledTimes(2);
    expect(unload).toHaveBeenCalledTimes(2);
  });
});

describe('embedding input limits', () => {
  it('sends a short query through with its prefix intact', async () => {
    const embeddings = makeEmbeddings();
    const embed = jest.spyOn(embeddings, 'embed').mockResolvedValue([0.1, 0.2]);

    await embeddings.embedQuery('Kto jest dyrektorem finansowym?');

    expect(embed).toHaveBeenCalledWith(
      'query: Kto jest dyrektorem finansowym?'
    );
  });

  it('trims a query that would exceed the embedder sequence cap', async () => {
    const embeddings = makeEmbeddings();
    const embed = jest.spyOn(embeddings, 'embed').mockResolvedValue([0.1, 0.2]);
    const longQuery = '泽菲里亚能源公司在波兰设有三个生产基地。'.repeat(40);

    await embeddings.embedQuery(longQuery);

    const sent = embed.mock.calls[0]![0] as string;
    expect(sent.length).toBeLessThan(longQuery.length);
    expect(estimatePromptTokens(sent)).toBeLessThanOrEqual(
      EMBEDDING_CHUNK_TOKEN_BUDGET
    );
  });
});
