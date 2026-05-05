// Downloads model files that are to be bundled with the app and loaded via require().

const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const VERSION_TAG = 'v0.8.0';

const ALL_MINI_LM_FILES = [
  `https://huggingface.co/software-mansion/react-native-executorch-all-MiniLM-L6-v2/resolve/${VERSION_TAG}/all-MiniLM-L6-v2_xnnpack.pte`,
  `https://huggingface.co/software-mansion/react-native-executorch-all-MiniLM-L6-v2/resolve/${VERSION_TAG}/tokenizer.json`,
];

async function ensureModelAssets() {
  const allMinilmDir = path.join(
    __dirname,
    '..',
    'assets',
    'models',
    'all-mini-lm'
  );
  fs.mkdirSync(allMinilmDir, { recursive: true });

  for (const url of ALL_MINI_LM_FILES) {
    const name = url.split('/').pop();
    const filePath = path.join(allMinilmDir, name);
    if (fs.existsSync(filePath)) {
      continue;
    }

    console.log(`Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to download ${url}: ${res.status} ${res.statusText}`
      );
    }

    // Write to a .part file first, then rename on success. Prevents a
    // half-finished or error-body file from being treated as valid on the
    // next run (fs.existsSync check above would skip the redownload).
    const tempPath = `${filePath}.part`;
    try {
      await new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(tempPath);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        Readable.fromWeb(res.body).pipe(fileStream);
      });
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
      throw err;
    }
  }
}

module.exports = { ensureModelAssets };
