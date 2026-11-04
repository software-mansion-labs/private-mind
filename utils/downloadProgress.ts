const ONE_PERCENT = 0.01;

export const hasDownloadStarted = (progress: number) => progress > 0;

export const formatDownloadPercent = (progress: number) => {
  if (!hasDownloadStarted(progress)) return 'Starting…';
  if (progress < ONE_PERCENT) return '<1%';
  return `${Math.floor(progress * 100)}%`;
};
