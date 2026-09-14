export const DocumentDirectoryPath = '/documents';
export const ExternalDirectoryPath = '/sdcard/Android/data/app/files';

export const writtenFiles = new Map<string, string>();

export const exists = jest.fn();
export const unlink = jest.fn(async (path: string) => {
  writtenFiles.delete(path);
});
export const copyFileAssets = jest.fn();
export const mkdir = jest.fn(async () => undefined);
export const writeFile = jest.fn(async (path: string, contents: string) => {
  writtenFiles.set(path, contents);
});
export const readDir = jest.fn(async (dirpath: string) =>
  [...writtenFiles.keys()]
    .filter((path) => path.startsWith(`${dirpath}/`))
    .map((path) => ({ path, name: path.slice(dirpath.length + 1) }))
);
