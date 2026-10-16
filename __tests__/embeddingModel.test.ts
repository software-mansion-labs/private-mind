import { embeddingModelDownloadSizeLabel } from '../utils/embeddingModel';

describe('embeddingModelDownloadSizeLabel', () => {
  it('quotes the size of the model file the app actually downloads', () => {
    expect(embeddingModelDownloadSizeLabel()).toBe('553 MB');
  });
});
