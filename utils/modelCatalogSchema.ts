import { z } from 'zod';
import { type Model } from '../database/modelRepository';

const httpsUrl = () =>
  z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), {
      message: 'must be an https:// URL',
    });

const perPlatform = <T extends z.ZodTypeAny>(value: T) =>
  z.union([value, z.object({ ios: value, android: value })]);

const catalogPathSchema = perPlatform(httpsUrl());
const catalogSizeSchema = perPlatform(z.number());

export const modelCatalogEntrySchema = z.object({
  modelName: z.string().min(1),
  family: z.string().optional(),
  modelPath: catalogPathSchema,
  tokenizerPath: catalogPathSchema,
  tokenizerConfigPath: catalogPathSchema,
  source: z.enum(['local', 'remote', 'built-in']).default('remote'),
  parameters: z.number().optional(),
  modelSize: catalogSizeSchema.optional(),
  featured: z.boolean().optional(),
  experimental: z.boolean().optional(),
  thinking: z.boolean().optional(),
  vision: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
  systemPrompt: z.string().nullable().optional(),
});

export const modelCatalogManifestSchema = z.object({
  schemaVersion: z.literal(1),
  models: z.array(modelCatalogEntrySchema).min(1),
});

export type ModelCatalogManifest = z.infer<typeof modelCatalogManifestSchema>;
export type ModelCatalogEntry = z.infer<typeof modelCatalogEntrySchema>;
export type CatalogModel = Omit<Model, 'id' | 'isDownloaded'>;
