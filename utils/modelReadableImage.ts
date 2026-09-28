import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const EXECUTORCH_DECODABLE_EXTENSIONS = [
  '.bmp',
  '.jpeg',
  '.jpg',
  '.png',
] as const;

export function isModelReadableImage(uri: string): boolean {
  const pathPart = uri.split('?')[0].split('#')[0];
  const lastSegment = pathPart.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex <= 0) return false;
  const extension = lastSegment.slice(dotIndex).toLowerCase();
  return EXECUTORCH_DECODABLE_EXTENSIONS.some((known) => known === extension);
}

export async function toModelReadableImage(uri: string): Promise<string> {
  if (isModelReadableImage(uri)) return uri;
  const rendered = await ImageManipulator.manipulate(uri).renderAsync();
  const { uri: jpeg } = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.92,
  });
  return jpeg;
}
