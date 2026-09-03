import { type Model } from '../database/modelRepository';
import { getModelProfile } from './model-profiles';

const TOKENS_PER_CHAR = {
  cjk: 1.0,
  denseAbugida: 0.6,
  rtlAndIndic: 0.5,
  nonLatinAlphabet: 0.5,
  latinAccented: 0.5,
  digit: 0.5,
  punctuation: 0.4,
  latin: 0.25,
  other: 1.0,
} as const;

const DEFAULT_TOKENS_PER_CHAR = 1 / 3;

export const getContextWindowTokens = (model: Model): number =>
  getModelProfile(model).contextWindowTokens;

const tokensForCodePoint = (code: number): number => {
  if (
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x20000 && code <= 0x3134f)
  ) {
    return TOKENS_PER_CHAR.cjk;
  }
  if (
    (code >= 0x0e00 && code <= 0x0eff) ||
    (code >= 0x1000 && code <= 0x109f) ||
    (code >= 0x1780 && code <= 0x17ff)
  ) {
    return TOKENS_PER_CHAR.denseAbugida;
  }
  if (
    (code >= 0x0590 && code <= 0x08ff) ||
    (code >= 0x0900 && code <= 0x0dff)
  ) {
    return TOKENS_PER_CHAR.rtlAndIndic;
  }
  if (
    (code >= 0x0370 && code <= 0x058f) ||
    (code >= 0x10a0 && code <= 0x10ff)
  ) {
    return TOKENS_PER_CHAR.nonLatinAlphabet;
  }
  if (code >= 0x00c0 && code <= 0x036f) {
    return TOKENS_PER_CHAR.latinAccented;
  }
  if (code >= 0x30 && code <= 0x39) return TOKENS_PER_CHAR.digit;
  if (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    code === 0x20 ||
    code === 0x0a ||
    code === 0x09
  ) {
    return TOKENS_PER_CHAR.latin;
  }
  if (code < 0x80) return TOKENS_PER_CHAR.punctuation;
  return TOKENS_PER_CHAR.other;
};

export const estimateCharTokens = (char: string): number =>
  tokensForCodePoint(char.codePointAt(0)!);

export const estimatePromptTokens = (text: string): number => {
  let tokens = 0;
  for (const char of text) {
    tokens += estimateCharTokens(char);
  }
  return Math.ceil(tokens);
};

export const getPromptTokenBudget = (model: Model): number => {
  const profile = getModelProfile(model);
  return Math.max(
    0,
    profile.contextWindowTokens - profile.generationReserveTokens
  );
};

export const PROMPT_TOKEN_SAFETY = 0.85;

export const getPromptCharBudget = (model: Model, sample?: string): number => {
  const tokenBudget = Math.floor(
    getPromptTokenBudget(model) * PROMPT_TOKEN_SAFETY
  );
  if (!sample || sample.length === 0) {
    return Math.floor(tokenBudget / DEFAULT_TOKENS_PER_CHAR);
  }
  const density = estimatePromptTokens(sample) / sample.length;
  return Math.max(0, Math.floor((tokenBudget - 1) / density));
};
