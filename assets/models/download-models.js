// Downloads model files that are to be bundled with the app and loaded via require().

const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const WHISPER_TINY_EN_FILES = [
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/tokenizer.json',
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/xnnpack/whisper_tiny_en_decoder_xnnpack.pte',
  'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny.en/resolve/v0.5.0/xnnpack/whisper_tiny_en_encoder_xnnpack.pte',
];

const ALL_MINI_LM_FILES = [
  'https://huggingface.co/software-mansion/react-native-executorch-all-MiniLM-L6-v2/resolve/main/all-MiniLM-L6-v2_xnnpack.pte',
  'https://huggingface.co/software-mansion/react-native-executorch-all-MiniLM-L6-v2/resolve/main/tokenizer.json',
];

async function ensureModelAssets() {
  const whisperDir = path.join(__dirname, 'whisper-tiny-en');
  const allMinilmDir = path.join(__dirname, 'all-mini-lm');
  fs.mkdirSync(whisperDir, { recursive: true });
  fs.mkdirSync(allMinilmDir, { recursive: true });

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
      fileStream.on('error', reject);
      Readable.fromWeb(res.body).pipe(fileStream);
    });
  }

  for (const url of ALL_MINI_LM_FILES) {
    const name = url.split('/').pop();
    const filePath = path.join(allMinilmDir, name);
    if (fs.existsSync(filePath)) {
      continue;
    }

    console.log(`Downloading ${url}...`);
    const res = await fetch(url);
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filePath);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      Readable.fromWeb(res.body).pipe(fileStream);
    });
  }
}

module.exports = { ensureModelAssets };
