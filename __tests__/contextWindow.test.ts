import {
  estimatePromptTokens,
  getContextWindowTokens,
  getPromptCharBudget,
} from '../constants/context-window';
import { Model } from '../database/modelRepository';

const makeModel = (family?: string): Model => ({
  id: 1,
  modelName: 'Test',
  family,
  source: 'remote',
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
});

describe('getContextWindowTokens', () => {
  it('caps every current export family at 2048', () => {
    for (const family of [
      'Qwen 3',
      'Qwen 2.5',
      'Llama 3.2',
      'LFM 2.5',
      'Bielik',
      'Gemma 4',
    ]) {
      expect(getContextWindowTokens(makeModel(family))).toBe(2048);
    }
  });

  it('keeps the 2048 default for unknown or imported models', () => {
    expect(getContextWindowTokens(makeModel(undefined))).toBe(2048);
    expect(getContextWindowTokens(makeModel('Some Custom Family'))).toBe(2048);
  });
});

describe('estimatePromptTokens', () => {
  it('is calibrated to the density measured on device for Polish', () => {
    const polish =
      'Dyrektorem finansowym spółki Zephyria jest Marta Kowalczyk-Nowak, ' +
      'powołana na to stanowisko 12 marca 2024 roku. Odpowiada za politykę ' +
      'budżetową oraz raportowanie kwartalne do rady nadzorczej. ';
    const sample = polish
      .repeat(Math.ceil(8320 / polish.length))
      .slice(0, 8320);

    const density = estimatePromptTokens(sample) / sample.length;

    expect(density).toBeGreaterThan(0.26);
    expect(density).toBeLessThan(0.34);
  });

  it('charges CJK far more per character than Latin', () => {
    const latin = 'the quick brown fox jumps over the lazy dog'.repeat(10);
    const chinese = '泽菲里亚能源公司在波兰设有三个生产基地'.repeat(10);

    const latinPerChar = estimatePromptTokens(latin) / latin.length;
    const chinesePerChar = estimatePromptTokens(chinese) / chinese.length;

    expect(latinPerChar).toBeLessThan(0.3);
    expect(chinesePerChar).toBeGreaterThanOrEqual(0.9);
  });

  it('handles surrogate pairs as single code points', () => {
    expect(estimatePromptTokens('🚀')).toBe(1);
  });

  it('returns zero for empty text', () => {
    expect(estimatePromptTokens('')).toBe(0);
  });
});

describe('getPromptCharBudget', () => {
  it('falls back to a safe Latin density when given no sample', () => {
    expect(getPromptCharBudget(makeModel('Gemma 4'))).toBe(3840);
    expect(getPromptCharBudget(makeModel('Qwen 2.5'))).toBe(3840);
  });

  it('grants Latin prose more characters than the flat fallback', () => {
    const english =
      'The quarterly report covers revenue, headcount and logistics. '.repeat(
        20
      );

    expect(getPromptCharBudget(makeModel('Gemma 4'), english)).toBeGreaterThan(
      3840
    );
  });

  it('shrinks the budget for CJK so the prompt stays under the cap', () => {
    const chinese = '泽菲里亚能源公司在波兰设有三个生产基地。'.repeat(20);

    const budget = getPromptCharBudget(makeModel('Gemma 4'), chinese);

    expect(budget).toBeLessThanOrEqual(1280);
    const filled = chinese
      .repeat(Math.ceil(budget / chinese.length) + 1)
      .slice(0, budget);
    expect(estimatePromptTokens(filled)).toBeLessThanOrEqual(1280);
  });

  it('keeps any script under the prompt token budget when filled to capacity', () => {
    const samples = [
      'Zephyria energetyka odnawialna sprawozdanie kwartalne. ',
      'Компания Зефирия управляет тремя заводами в Польше. ',
      'شركة زفيريا تدير ثلاثة مصانع في بولندا. ',
      '泽菲里亚能源公司在波兰设有三个生产基地。',
      'ゼフィリア・エナジーはポーランドに三つの工場を持っています。',
      'บริษัทเซฟีเรียมีโรงงานสามแห่งในโปแลนด์ ',
    ];

    for (const sample of samples) {
      const text = sample.repeat(200);
      const budget = getPromptCharBudget(makeModel('Gemma 4'), text);
      const filled = text.slice(0, budget);
      expect(estimatePromptTokens(filled)).toBeLessThanOrEqual(1280);
    }
  });
});
