import { Model } from '../database/modelRepository';

export type ParamsUnit = 'B' | 'B params';

type MetaPart = string | null | undefined | false;

export const formatGB = (gigabytes: number) => `${gigabytes.toFixed(2)} GB`;

export const joinMeta = (parts: MetaPart[]) =>
  parts.filter(Boolean).join(' · ');

export const modelSpecParts = (
  model: Pick<Model, 'modelSize' | 'parameters'>,
  paramsUnit: ParamsUnit
): MetaPart[] => [
  model.modelSize ? formatGB(model.modelSize) : null,
  model.parameters ? `${model.parameters.toFixed(2)} ${paramsUnit}` : null,
];

export const formatModelMeta = (
  model: Pick<Model, 'modelSize' | 'parameters'>,
  paramsUnit: ParamsUnit
) => joinMeta(modelSpecParts(model, paramsUnit));
