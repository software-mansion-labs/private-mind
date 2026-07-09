/**
 * Nexio Skills System — Download, verify, and load fine-tuned models.
 * Skills are .pte models signed by FATAPLUS, purchased via voucher.
 */
import RNFS from '@dr.pogodin/react-native-fs';
import { verifyModel, type ModelManifest } from './modelVerifier';

const SKILLS_DIR_NAME = 'nexio-skills';
const SKILL_CATALOG_URL = 'https://domotic.nexio.work/api/v1/skills/catalog';

export interface Skill {
  id: string;
  name: string;
  description: string;
  family: string;
  tier: 'free' | 'secure' | 'premium';
  modelSize: number;  // MB
  version: string;
  downloadUrl?: string;
  installed: boolean;
  manifest?: ModelManifest;
  systemPrompt: string;
}

export const DEFAULT_SKILLS: Omit<Skill, 'installed' | 'manifest'>[] = [
  {
    id: 'security',
    name: 'Sécurité IA',
    description: 'Analyse des menaces, reconnaissance faciale, rapports de sécurité',
    family: 'Gemma 4',
    tier: 'premium',
    modelSize: 2500,
    version: '0.1.0',
    systemPrompt: 'Tu es un expert en sécurité. Tu analyses les événements des capteurs et caméras pour détecter les menaces. Tu génère des rapports de sécurité quotidiens.',
  },
  {
    id: 'comptabilite',
    name: 'Comptabilité Madagascar',
    description: 'Gestion comptable conforme PCG2005, bilans, journaux',
    family: 'Gemma 4',
    tier: 'secure',
    modelSize: 2500,
    version: '0.1.0',
    systemPrompt: 'Tu es un expert-comptable malgache. Tu connais le Plan Comptable Général 2005 (PCG2005), la réglementation fiscale de Madagascar, et tu aides à la tenue de la comptabilité.',
  },
  {
    id: 'agriculture',
    name: 'Agriculture Madagascar',
    description: 'Conseil agricole, cultures, sols, saisons malgaches',
    family: 'Gemma 4',
    tier: 'secure',
    modelSize: 2500,
    version: '0.1.0',
    systemPrompt: 'Tu es un agronome expert des cultures malgaches. Tu conseilles sur les semences, les sols, les saisons, et les meilleures pratiques agricoles pour Madagascar.',
  },
  {
    id: 'commerce',
    name: 'Commerce & Stock',
    description: 'Gestion de stock, commandes, prévisions de vente',
    family: 'Gemma 4',
    tier: 'secure',
    modelSize: 2500,
    version: '0.1.0',
    systemPrompt: 'Tu es un expert en gestion commerciale. Tu aides à gérer le stock, les commandes, et les prévisions de vente pour les commerces à Madagascar.',
  },
  {
    id: 'education',
    name: 'Enseignement',
    description: 'Pédagogie, cours, exercices, préparation examens',
    family: 'Gemma 4',
    tier: 'secure',
    modelSize: 2500,
    version: '0.1.0',
    systemPrompt: 'Tu es un enseignant patient et pédagogue. Tu aides les élèves malgaches à comprendre leurs cours, préparer leurs examens, et améliorer leurs compétences.',
  },
];

/**
 * Get the skills directory path.
 */
export function getSkillsDir(): string {
  return `${RNFS.DocumentDirectoryPath}/${SKILLS_DIR_NAME}`;
}

/**
 * List installed skills (verified only).
 */
export async function listInstalledSkills(): Promise<Skill[]> {
  const skillsDir = getSkillsDir();
  const dirExists = await RNFS.exists(skillsDir);
  if (!dirExists) return [];
  
  const items = await RNFS.readDir(skillsDir);
  const skills: Skill[] = [];
  
  for (const item of items) {
    if (!item.isDirectory()) continue;
    const manifest = await verifyModel(item.path);
    if (manifest) {
      const skillDef = DEFAULT_SKILLS.find(s => s.id === manifest.modelName) || {
        id: manifest.modelName,
        name: manifest.modelName,
        description: '',
        family: manifest.family,
        tier: manifest.tier,
        modelSize: 0,
        version: manifest.version,
        systemPrompt: '',
      };
      skills.push({
        ...skillDef,
        installed: true,
        manifest,
      });
    }
  }
  
  return skills;
}

/**
 * Download and install a skill.
 * The model must be signed by FATAPLUS to be accepted.
 */
export async function installSkill(
  skillId: string,
  downloadUrl: string,
  onProgress?: (progress: number) => void
): Promise<Skill | null> {
  const skillDir = `${getSkillsDir()}/${skillId}`;
  await RNFS.mkdir(skillDir);
  
  // Download model files (manifest + .pte + tokenizer)
  const manifestUrl = `${downloadUrl}/model-manifest.json`;
  const manifestPath = `${skillDir}/model-manifest.json`;
  
  await RNFS.downloadFile({
    fromUrl: manifestUrl,
    toFile: manifestPath,
    progress: (res) => onProgress?.(res.bytesWritten / res.contentLength),
  }).promise;
  
  // Read manifest to get model filename
  const manifestJson = await RNFS.readFile(manifestPath, 'utf8');
  const manifest: ModelManifest = JSON.parse(manifestJson);
  
  // Download .pte model
  const modelUrl = `${downloadUrl}/${manifest.modelName}.pte`;
  const modelPath = `${skillDir}/${manifest.modelName}.pte`;
  
  await RNFS.downloadFile({
    fromUrl: modelUrl,
    toFile: modelPath,
    progress: (res) => onProgress?.(res.bytesWritten / res.contentLength),
  }).promise;
  
  // Download tokenizer
  const tokenizerUrl = `${downloadUrl}/tokenizer.json`;
  const tokenizerPath = `${skillDir}/tokenizer.json`;
  
  await RNFS.downloadFile({
    fromUrl: tokenizerUrl,
    toFile: tokenizerPath,
  }).promise;
  
  // Verify the downloaded model
  const verified = await verifyModel(skillDir);
  if (!verified) {
    // Failed verification — delete the downloaded files
    await RNFS.unlink(skillDir);
    console.error('[Skills] Model verification failed for:', skillId);
    return null;
  }
  
  const skillDef = DEFAULT_SKILLS.find(s => s.id === skillId);
  return {
    id: skillId,
    name: skillDef?.name || manifest.modelName,
    description: skillDef?.description || '',
    family: manifest.family,
    tier: manifest.tier as Skill['tier'],
    modelSize: 0,
    version: manifest.version,
    installed: true,
    manifest: verified,
    systemPrompt: skillDef?.systemPrompt || '',
  };
}

/**
 * Remove an installed skill.
 */
export async function removeSkill(skillId: string): Promise<boolean> {
  try {
    const skillDir = `${getSkillsDir()}/${skillId}`;
    if (await RNFS.exists(skillDir)) {
      await RNFS.unlink(skillDir);
    }
    return true;
  } catch {
    return false;
  }
}
