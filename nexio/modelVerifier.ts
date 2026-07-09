/**
 * Nexio Model Verifier — Only signed .pte models can be loaded.
 * Uses Ed25519 signatures to verify model authenticity.
 */
import RNFS from '@dr.pogodin/react-native-fs';

const SIGNATURE_EXTENSION = '.sig';
const MANIFEST_FILENAME = 'model-manifest.json';

export interface ModelManifest {
  modelName: string;
  version: string;
  family: string;
  checksum: string;  // SHA-256 of the .pte file
  signature: string; // base64 Ed25519 signature of checksum
  publicKey: string; // base64 Ed25519 public key
  tier: 'free' | 'secure' | 'premium';
  capabilities: string[];
  signedAt: string;
  signedBy: string;  // 'fataplus'
}

// FATAPLUS Ed25519 public key — baked into the binary
// Models MUST be signed by this key to be loaded
const FATAPLUS_PUBLIC_KEY = 'PLACEHOLDER_BASE64_PUBLIC_KEY';

/**
 * Verify a model's signature before loading.
 * Returns the manifest if valid, null if rejected.
 */
export async function verifyModel(modelDir: string): Promise<ModelManifest | null> {
  try {
    // 1. Read manifest
    const manifestPath = `${modelDir}/${MANIFEST_FILENAME}`;
    if (!await RNFS.exists(manifestPath)) {
      console.warn('[ModelVerifier] No manifest found:', manifestPath);
      return null;
    }
    
    const manifestJson = await RNFS.readFile(manifestPath, 'utf8');
    const manifest: ModelManifest = JSON.parse(manifestJson);
    
    // 2. Verify signature matches FATAPLUS public key
    if (manifest.signedBy !== 'fataplus') {
      console.warn('[ModelVerifier] Model not signed by FATAPLUS');
      return null;
    }
    
    // 3. Verify Ed25519 signature
    const isValid = await verifySignature(
      manifest.checksum,
      manifest.signature,
      FATAPLUS_PUBLIC_KEY
    );
    
    if (!isValid) {
      console.warn('[ModelVerifier] Invalid signature for model:', manifest.modelName);
      return null;
    }
    
    // 4. Verify checksum of actual .pte file
    const modelPath = `${modelDir}/${manifest.modelName}.pte`;
    if (!await RNFS.exists(modelPath)) {
      console.warn('[ModelVerifier] Model file not found:', modelPath);
      return null;
    }
    
    const actualChecksum = await RNFS.hash(modelPath, 'sha256');
    if (actualChecksum !== manifest.checksum) {
      console.warn('[ModelVerifier] Checksum mismatch for:', manifest.modelName);
      return null;
    }
    
    console.log('[ModelVerifier] Model verified:', manifest.modelName, manifest.version);
    return manifest;
  } catch (error) {
    console.error('[ModelVerifier] Verification failed:', error);
    return null;
  }
}

/**
 * Verify an Ed25519 signature.
 * Uses SubtleCrypto when available, falls back to pure JS.
 */
async function verifySignature(
  data: string,
  signatureB64: string,
  publicKeyB64: string
): Promise<boolean> {
  try {
    // Convert from base64
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const sigBytes = base64ToUint8Array(signatureB64);
    const pubKeyBytes = base64ToUint8Array(publicKeyB64);
    
    // Use SubtleCrypto (available in React Native Hermes with polyfill)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    
    return await crypto.subtle.verify('Ed25519', cryptoKey, sigBytes, dataBytes);
  } catch (error) {
    console.error('[ModelVerifier] Crypto verification error:', error);
    return false;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
