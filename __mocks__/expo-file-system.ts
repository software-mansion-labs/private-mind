export const File = jest.fn().mockImplementation(() => ({
  text: jest.fn(),
}));

export const cacheDirectory = 'file:///cache/';
export const copyAsync = jest.fn(({ to }: { from: string; to: string }) =>
  Promise.resolve(to)
);
