export const Paths = {
  cache: { uri: 'file:///cache/' },
};

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
      text: jest.fn(),
      copy: jest.fn(),
    };
  });
