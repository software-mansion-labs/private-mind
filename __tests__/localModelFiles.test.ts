import { Platform } from 'react-native';

const mockMove = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: {
    cache: { uri: 'file:///data/app/cache/' },
    document: { uri: 'file:///data/app/files/' },
  },
  Directory: jest.fn().mockImplementation((parent: { uri: string }, name) => ({
    uri: `${parent.uri}${name}/`,
    create: jest.fn(),
  })),
  File: jest
    .fn()
    .mockImplementation((parentOrUri: { uri: string } | string, name) => {
      const uri =
        typeof parentOrUri === 'string'
          ? parentOrUri
          : `${parentOrUri.uri}${name}`;
      return { uri, name: uri.split('/').pop(), move: mockMove };
    }),
}));

import { keepPickedModelFile } from '../utils/localModelFiles';

const setPlatform = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

afterEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
});

describe('keepPickedModelFile', () => {
  it('moves a model file the Android picker copied into the cache to the app documents', () => {
    setPlatform('android');

    const kept = keepPickedModelFile(
      '/data/app/cache/DocumentPicker/abc/model.pte'
    );

    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(kept).toMatch(/^\/data\/app\/files\/local-models\/\d+-model\.pte$/);
  });

  it('leaves a file that is already the app’s own where it is', () => {
    setPlatform('android');

    const path = '/data/app/files/local-models/1-model.pte';

    expect(keepPickedModelFile(path)).toBe(path);
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('leaves iOS paths alone, the picker hands over the original file there', () => {
    setPlatform('ios');

    const path = '/private/var/mobile/Downloads/model.pte';

    expect(keepPickedModelFile(path)).toBe(path);
    expect(mockMove).not.toHaveBeenCalled();
  });
});
