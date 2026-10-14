export const ExpoResourceFetcher = {
  cancelFetching: jest.fn(),
  pauseFetching: jest.fn(async () => undefined),
  resumeFetching: jest.fn(async () => undefined),
  deleteResources: jest.fn(),
  listDownloadedFiles: jest.fn(async () => [] as string[]),
  getFilesTotalSize: jest.fn(async () => 0),
};
