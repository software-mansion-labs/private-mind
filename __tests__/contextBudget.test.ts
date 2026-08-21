import { webContextCharBudget } from '../utils/web/contextBudget';
import { getPromptCharBudget } from '../constants/context-window';
import { WEB_SNIPPET_MAX_CHARS } from '../constants/web';
import { Model } from '../database/modelRepository';

const baseModel: Model = {
  id: 1,
  modelName: 'TestModel',
  source: 'local',
  isDownloaded: true,
  modelPath: '/path/model.pte',
  tokenizerPath: '/path/tokenizer.json',
  tokenizerConfigPath: '/path/tokenizer_config.json',
  thinking: false,
};

describe('webContextCharBudget', () => {
  it('returns undefined when there is no model yet', () => {
    expect(webContextCharBudget(undefined, [])).toBeUndefined();
    expect(webContextCharBudget(null, [])).toBeUndefined();
  });

  it('shrinks the budget as the actual system prompt grows (F12)', () => {
    const shortPrompt = 'You are a helpful assistant.';
    const longPrompt = 'x'.repeat(2000);

    const withShortPrompt = webContextCharBudget(baseModel, [], shortPrompt)!;
    const withLongPrompt = webContextCharBudget(baseModel, [], longPrompt)!;

    expect(withLongPrompt).toBeLessThan(withShortPrompt);
    expect(withShortPrompt - withLongPrompt).toBeCloseTo(
      longPrompt.length - shortPrompt.length,
      0
    );
  });

  it('accounts for context already spent on attached documents', () => {
    const withoutExisting = webContextCharBudget(baseModel, [], '')!;
    const withExisting = webContextCharBudget(
      baseModel,
      ['x'.repeat(500)],
      ''
    )!;
    expect(withExisting).toBeLessThan(withoutExisting);
  });

  it('never drops below the minimum snippet size, even under heavy pressure', () => {
    const hugeSystemPrompt = 'x'.repeat(getPromptCharBudget(baseModel) * 5);
    expect(webContextCharBudget(baseModel, [], hugeSystemPrompt)).toBe(
      WEB_SNIPPET_MAX_CHARS
    );
  });
});
