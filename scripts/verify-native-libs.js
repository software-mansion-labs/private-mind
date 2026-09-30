#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_ROOT = path.join(
  PROJECT_ROOT,
  'node_modules',
  'react-native-executorch'
);
const THIRD_PARTY_DIR = path.join(PACKAGE_ROOT, 'third-party');
const LOCK_PATH = path.join(PROJECT_ROOT, 'native-libs.lock.json');
const HASHED_SUBTREES = [path.join('android', 'libs'), path.join('ios')];

const readNativeLibsVersion = () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')
  );
  return manifest.nativeLibsVersion || null;
};

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile()) return [full];
    return [];
  });
};

const hashFile = (file) =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const collectArtifacts = () => {
  const artifacts = {};
  for (const subtree of HASHED_SUBTREES) {
    const root = path.join(THIRD_PARTY_DIR, subtree);
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const key = path
        .relative(THIRD_PARTY_DIR, file)
        .split(path.sep)
        .join('/');
      artifacts[key] = hashFile(file);
    }
  }
  return Object.fromEntries(
    Object.keys(artifacts)
      .sort()
      .map((key) => [key, artifacts[key]])
  );
};

const writeLock = (nativeLibsVersion, artifacts) => {
  fs.writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ nativeLibsVersion, artifacts }, null, 2)}\n`
  );
};

const fail = (lines) => {
  console.error(`\n[native-libs] ${lines.join('\n[native-libs] ')}\n`);
  process.exit(1);
};

const main = () => {
  const update = process.argv.includes('--update');

  if (!fs.existsSync(THIRD_PARTY_DIR)) {
    console.warn('[native-libs] third-party/ is absent, nothing to verify');
    return;
  }

  const nativeLibsVersion = readNativeLibsVersion();
  const artifacts = collectArtifacts();

  if (update) {
    writeLock(nativeLibsVersion, artifacts);
    console.log(
      `[native-libs] locked ${Object.keys(artifacts).length} artifacts of v${nativeLibsVersion}-libs`
    );
    return;
  }

  if (!fs.existsSync(LOCK_PATH)) {
    fail([
      'native-libs.lock.json is missing.',
      'Run `node scripts/verify-native-libs.js --update` and commit the result.',
    ]);
  }

  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));

  if (lock.nativeLibsVersion !== nativeLibsVersion) {
    fail([
      `react-native-executorch asks for v${nativeLibsVersion}-libs but the lock pins v${lock.nativeLibsVersion}-libs.`,
      'If the bump is intended, re-run `node scripts/verify-native-libs.js --update` and commit the result.',
    ]);
  }

  const changed = [];
  const missing = [];
  for (const [key, expected] of Object.entries(lock.artifacts)) {
    const actual = artifacts[key];
    if (actual === undefined) missing.push(key);
    else if (actual !== expected) changed.push(key);
  }
  const added = Object.keys(artifacts).filter(
    (key) => !(key in lock.artifacts)
  );

  if (changed.length > 0) {
    fail([
      `${changed.length} native artifact(s) differ from the lock although the version is unchanged:`,
      ...changed.map((key) => `  ${key}`),
      '',
      `The v${nativeLibsVersion}-libs release tag was re-cut in place. The binaries you are about to`,
      'build with are NOT the ones this branch was tested against.',
      'Verify the change upstream, retest on devices, then re-run',
      '`node scripts/verify-native-libs.js --update` and commit the result.',
    ]);
  }

  for (const key of missing) {
    console.warn(`[native-libs] not downloaded on this host: ${key}`);
  }
  for (const key of added) {
    console.warn(`[native-libs] present but absent from the lock: ${key}`);
  }

  console.log(
    `[native-libs] ${Object.keys(lock.artifacts).length - missing.length} artifact(s) match v${nativeLibsVersion}-libs`
  );
};

main();
