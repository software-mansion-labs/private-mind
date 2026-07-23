export const ExpoResourceFetcher = {
  cancelFetching: jest.fn(),
  deleteResources: jest.fn(),
  listDownloadedFiles: jest.fn(async () => [] as string[]),
  getFilesTotalSize: jest.fn(async () => 0),
};
