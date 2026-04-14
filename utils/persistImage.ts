import { Directory, File, Paths } from 'expo-file-system';

const CHAT_IMAGES_DIR = 'chat-images';

export async function persistImage(sourceUri: string): Promise<string> {
  const dir = new Directory(Paths.document, CHAT_IMAGES_DIR);
  dir.create({ idempotent: true, intermediates: true });

  const ext = extractExtension(sourceUri);
  const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destination = new File(Paths.document, CHAT_IMAGES_DIR, filename);

  const source = new File(sourceUri);
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
