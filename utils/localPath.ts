export const toLocalPath = (source: string) =>
  decodeURIComponent(source.replace(/^file:\/\//, ''));
