const mockSaveAsync = jest.fn(async () => ({
  uri: 'file:///cache/converted.jpg',
  width: 1,
  height: 1,
}));
const mockRenderAsync = jest.fn(async () => ({ saveAsync: mockSaveAsync }));
const mockManipulate = jest.fn((_uri: string) => ({
  renderAsync: mockRenderAsync,
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (uri: string) => mockManipulate(uri) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

import {
  EXECUTORCH_DECODABLE_EXTENSIONS,
  isModelReadableImage,
  toModelReadableImage,
} from '../utils/modelReadableImage';

beforeEach(() => jest.clearAllMocks());

describe('what ExecuTorch can decode', () => {
  it('lists only the formats its OpenCV build carries a decoder for', () => {
    expect([...EXECUTORCH_DECODABLE_EXTENSIONS]).toEqual([
      '.bmp',
      '.jpeg',
      '.jpg',
      '.png',
    ]);
  });

  it.each(['file:///a/photo.jpg', 'file:///a/PHOTO.JPEG', 'file:///a/b.PNG'])(
    'passes %s through untouched',
    async (uri) => {
      expect(isModelReadableImage(uri)).toBe(true);
      expect(await toModelReadableImage(uri)).toBe(uri);
      expect(mockManipulate).not.toHaveBeenCalled();
    }
  );

  it('turns an iPhone library photo into a JPEG instead of handing over HEIC', async () => {
    const heic = 'file:///var/mobile/Media/DCIM/100APPLE/IMG_0042.HEIC';

    expect(isModelReadableImage(heic)).toBe(false);
    expect(await toModelReadableImage(heic)).toBe(
      'file:///cache/converted.jpg'
    );
    expect(mockManipulate).toHaveBeenCalledWith(heic);
    expect(mockSaveAsync).toHaveBeenCalledWith({
      format: 'jpeg',
      compress: 0.92,
    });
  });

  it.each([
    'file:///a/sticker.webp',
    'file:///a/loop.gif',
    'file:///a/scan.tif',
  ])('converts %s, which would come back as an empty matrix', async (uri) => {
    expect(await toModelReadableImage(uri)).toBe('file:///cache/converted.jpg');
  });

  it('converts a file with no extension rather than assuming it is a JPEG', async () => {
    expect(isModelReadableImage('file:///a/IMG_0042')).toBe(false);
    expect(await toModelReadableImage('file:///a/IMG_0042')).toBe(
      'file:///cache/converted.jpg'
    );
  });

  it('reads the extension past a query string', () => {
    expect(isModelReadableImage('file:///a/photo.jpg?width=100')).toBe(true);
    expect(isModelReadableImage('file:///a/photo.heic?width=100')).toBe(false);
  });
});
