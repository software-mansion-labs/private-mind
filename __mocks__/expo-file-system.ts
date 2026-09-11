export const Paths = {
  cache: { uri: 'file:///cache/' },
  document: { uri: 'file:///documents/' },
};

export const writtenFiles = new Map<string, string>();

export const File = jest
  .fn()
  .mockImplementation((uriOrDir: any, name?: string) => {
    const uri = name
      ? `${typeof uriOrDir === 'string' ? uriOrDir : uriOrDir.uri}${name}`
      : typeof uriOrDir === 'string'
        ? uriOrDir
        : uriOrDir.uri;
    return {
      uri,
      size: 0,
      text: jest.fn(async () => writtenFiles.get(uri) ?? ''),
      write: jest.fn(async (contents: string) => {
        writtenFiles.set(uri, contents);
      }),
      copy: jest.fn(),
      delete: jest.fn(),
    };
  });
