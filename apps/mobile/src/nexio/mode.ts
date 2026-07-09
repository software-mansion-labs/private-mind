import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import RNFS from '@dr.pogodin/react-native-fs';

export type NexioMode = 'box' | 'client' | 'installer';

export interface BoxConfig {
  serialNumber: string;
  capabilities: string[];
  apiPort: number;
  tailscaleIp?: string;
}

/**
 * Detect whether this device is a Nexio Box or a client phone.
 * Box mode = rooted device with ExecuTorch runtime + sensor bridge available.
 * Client mode = normal phone connecting to a box remotely.
 * Installer mode = triggered by QR scan during setup.
 */
export async function detectMode(): Promise<NexioMode> {
  if (Platform.OS !== 'android') return 'client';
  
  // Check for root indicators
  const isRooted = await checkRoot();
  
  // Check for box config file (placed during box provisioning)
  const boxConfigExists = await RNFS.exists(
    RNFS.DocumentDirectoryPath + '/nexio-box-config.json'
  );
  
  if (isRooted && boxConfigExists) return 'box';
  return 'client';
}

async function checkRoot(): Promise<boolean> {
  try {
    // Check common root indicators
    const paths = ['/system/app/Superuser.apk', '/system/xbin/su', '/system/bin/su', '/sbin/su', '/data/local/xbin/su', '/data/local/bin/su'];
    for (const p of paths) {
      if (await RNFS.exists(p)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function loadBoxConfig(): Promise<BoxConfig | null> {
  try {
    const path = RNFS.DocumentDirectoryPath + '/nexio-box-config.json';
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    const content = await RNFS.readFile(path, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
