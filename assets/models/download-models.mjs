import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

const WHISPER_TOKENIZER =
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.4.0/whisper_tokenizer.json';
const WHISPER_TINY_DECODER =
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.4.0/xnnpack/whisper_tiny_en_xnnpack_decoder.pte';
const WHISPER_TINY_ENCODER =
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.4.0/xnnpack/whisper_tiny_en_xnnpack_encoder.pte';

const files = [
  {
    url: WHISPER_TOKENIZER,
    name: 'tokenizer.json',
  },
  {
    url: WHISPER_TINY_DECODER,
    name: 'decoder.pte',
  },
  {
    url: WHISPER_TINY_ENCODER,
    name: 'encoder.pte',
  },
];

const whisperDir = path.join(import.meta.dirname, 'whisper-en');
fs.mkdirSync(whisperDir, { recursive: true });

for (const { url, name } of files) {
  const filePath = path.join(whisperDir, name);
  if (fs.existsSync(filePath)) {
    continue;
  }

  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath);
    fileStream.on('finish', resolve);
    Readable.fromWeb(res.body).pipe(fileStream);
  });
}
