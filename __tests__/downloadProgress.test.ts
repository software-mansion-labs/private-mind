import {
  formatDownloadPercent,
  hasDownloadStarted,
} from '../utils/downloadProgress';

describe('hasDownloadStarted', () => {
  it('is false until the first bytes arrive', () => {
    expect(hasDownloadStarted(0)).toBe(false);
    expect(hasDownloadStarted(0.0001)).toBe(true);
  });
});

describe('formatDownloadPercent', () => {
  it.each([
    [0, 'Starting…'],
    [0.0001, '<1%'],
    [0.0099, '<1%'],
    [0.01, '1%'],
    [0.479, '47%'],
    [1, '100%'],
  ])('formats %p as %p', (progress, expected) => {
    expect(formatDownloadPercent(progress)).toBe(expected);
  });
});
