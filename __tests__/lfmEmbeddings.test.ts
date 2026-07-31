import { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { estimatePromptTokens } from '../constants/context-window';
import { EMBEDDING_CHUNK_TOKEN_BUDGET } from '../constants/retrieval';

const makeEmbeddings = () =>
  new LFMEmbeddings({
    modelSource: 'file://embedding-model.pte',
    tokenizerSource: 'file://tokenizer.json',
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
