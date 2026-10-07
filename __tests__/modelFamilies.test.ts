import { DEFAULT_MODELS } from '../constants/default-models';
import { MODEL_FAMILIES } from '../constants/model-families';
import { getModelFamily } from '../utils/modelFamily';

const MAX_DESCRIPTION_SENTENCES = 3;

const countSentences = (text: string) =>
  text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length;

describe('MODEL_FAMILIES', () => {
  it.each(Array.from(new Set(DEFAULT_MODELS.map(getModelFamily))))(
    'describes the built-in family %s',
    (family) => {
      expect(MODEL_FAMILIES[family]).toBeDefined();
    }
  );

  it.each(Object.entries(MODEL_FAMILIES))(
    '%s keeps its description to at most three sentences',
    (_, info) => {
      expect(countSentences(info.description)).toBeLessThanOrEqual(
        MAX_DESCRIPTION_SENTENCES
      );
    }
  );

  it.each(Object.entries(MODEL_FAMILIES))(
    '%s has a provider and a one-line summary',
    (_, info) => {
      expect(info.provider.length).toBeGreaterThan(0);
      expect(info.summary.length).toBeGreaterThan(0);
      expect(info.summary).not.toMatch(/\n/);
    }
  );
});
