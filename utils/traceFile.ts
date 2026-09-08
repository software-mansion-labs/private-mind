import {
  DocumentDirectoryPath,
  ExternalDirectoryPath,
  mkdir,
  readDir,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { WEB_TRACE_KEEP_FILES } from '../constants/web';

const traceDirectory = (name: string): string =>
  `${ExternalDirectoryPath || DocumentDirectoryPath}/${name}`;

export const traceFileName = (question: string): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${stamp}${slug ? `-${slug}` : ''}.json`;
};

const pruneOldTraces = async (directory: string): Promise<void> => {
  const traces = (await readDir(directory))
    .filter((entry) => entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const stale of traces.slice(0, traces.length - WEB_TRACE_KEEP_FILES)) {
    await unlink(stale.path);
  }
};

export const writeTraceFile = async (
  directory: string,
  question: string,
  body: string
): Promise<void> => {
  try {
    const dir = traceDirectory(directory);
    await mkdir(dir);
    const path = `${dir}/${traceFileName(question)}`;
    await writeFile(path, body, 'utf8');
    await pruneOldTraces(dir);
    console.log(`Trace ${path}`);
  } catch (error) {
    console.warn(`Trace failed ${String(error)}`);
  }
};
