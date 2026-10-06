import { Directory, File, Paths } from 'expo-file-system';
import { toModelReadableImage } from './modelReadableImage';

const CHAT_IMAGES_DIR = 'chat-images';

export async function persistImage(sourceUri: string): Promise<string> {
  const readableUri = await toModelReadableImage(sourceUri);

  const dir = new Directory(Paths.document, CHAT_IMAGES_DIR);
  dir.create({ idempotent: true, intermediates: true });

  const ext = extractExtension(readableUri);
  const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destination = new File(Paths.document, CHAT_IMAGES_DIR, filename);

  const source = new File(readableUri);
  source.copy(destination);

  return destination.uri;
}

function extractExtension(uri: string): string {
  const pathPart = uri.split('?')[0].split('#')[0];
  const lastSegment = pathPart.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
    return '.jpg';
  }
  return lastSegment.slice(dotIndex).toLowerCase();
}

const SAVED_IMAGE_NAME = /^img-(\d+)-/;
const IMAGE_BEING_SENT_MS = 60_000;

const fileNameOf = (uri: string) => uri.split('/').pop() ?? '';

export function removeImagesNoMessageUses(
  pathsInUse: string[],
  now = Date.now()
): void {
  const dir = new Directory(Paths.document, CHAT_IMAGES_DIR);
  if (!dir.exists) return;
  const namesInUse = new Set(pathsInUse.map(fileNameOf));
  for (const entry of dir.list()) {
    const name = fileNameOf(entry.uri);
    const savedAt = SAVED_IMAGE_NAME.exec(name)?.[1];
    if (savedAt === undefined || namesInUse.has(name)) continue;
    if (now - Number(savedAt) < IMAGE_BEING_SENT_MS) continue;
    entry.delete();
  }
}
