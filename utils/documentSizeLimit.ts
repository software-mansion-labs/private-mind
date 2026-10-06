const READ_WHOLE_INTO_MEMORY = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'html',
  'htm',
]);

export const MAX_TEXT_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const isTooLargeToRead = (
  fileType: string,
  sizeInBytes: number | null | undefined
): boolean =>
  READ_WHOLE_INTO_MEMORY.has(fileType) &&
  (sizeInBytes ?? 0) > MAX_TEXT_DOCUMENT_BYTES;
