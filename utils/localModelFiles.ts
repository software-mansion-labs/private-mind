import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

const LOCAL_MODELS_DIR = 'local-models';

const withoutScheme = (uri: string) => uri.replace('file://', '');

const isPickerCopy = (path: string) =>
  path.startsWith(withoutScheme(Paths.cache.uri));

export const keepPickedModelFile = (path: string): string => {
  if (Platform.OS !== 'android' || !isPickerCopy(path)) return path;
  const picked = new File(`file://${path}`);
  const dir = new Directory(Paths.document, LOCAL_MODELS_DIR);
  dir.create({ idempotent: true, intermediates: true });
  const destination = new File(dir, `${Date.now()}-${picked.name}`);
  picked.move(destination);
  return withoutScheme(destination.uri);
};

const isKeptCopy = (uri: string) =>
  withoutScheme(uri).startsWith(
    withoutScheme(new Directory(Paths.document, LOCAL_MODELS_DIR).uri)
  );

export const removeKeptModelFiles = (uris: string[]): void => {
  for (const uri of uris.filter(isKeptCopy)) {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
};
