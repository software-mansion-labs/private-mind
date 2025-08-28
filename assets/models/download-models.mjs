// Downloads model files that are to be bundled with the app and loaded via require().

import path from 'node:path';
import fs from 'node:fs';
import { Readable } from 'node:stream';

const WHISPER_TINY_EN_FILES = [
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/tokenizer.json',
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/xnnpack/whisper_tiny_en_decoder_xnnpack.pte',
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/xnnpack/whisper_tiny_en_encoder_xnnpack.pte',
];

export async function ensureModelAssets() {
  const whisperDir = path.join(import.meta.dirname, 'whisper-tiny-en');
  fs.mkdirSync(whisperDir, { recursive: true });

  for (const url of WHISPER_TINY_EN_FILES) {
    const name = url.split('/').pop();
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
}
