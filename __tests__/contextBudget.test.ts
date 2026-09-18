import { webContextCharBudget } from '../utils/web/contextBudget';
import { getPromptCharBudget } from '../constants/context-window';
import { WEB_SNIPPET_MAX_CHARS } from '../constants/web';
import { Model } from '../database/modelRepository';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import type {
  ChatSettings,
  Message,
  SourceDocument,
} from '../database/chatRepository';

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
    const longPrompt = 'x'.repeat(300);

    const withShortPrompt = webContextCharBudget(baseModel, [], shortPrompt)!;
    const withLongPrompt = webContextCharBudget(baseModel, [], longPrompt)!;

    expect(withLongPrompt).toBeLessThan(withShortPrompt);
    expect(withShortPrompt - withLongPrompt).toBeCloseTo(
      longPrompt.length - shortPrompt.length,
      0
    );
  });

  it('uses the question to judge character density, so a dense script gets less room', () => {
    const latin = webContextCharBudget(
      baseModel,
      [],
      '',
      'How much does the Samsung Galaxy S25 cost in Poland?'
    )!;
    const cjk = webContextCharBudget(
      baseModel,
      [],
      '',
      '三星 Galaxy S25 在波兰的价格是多少？'
    )!;
    expect(cjk).toBeLessThan(latin);
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

  it('reserves enough for the instruction block a web answer actually gets', () => {
    const question = 'How tall is the Burj Khalifa?';
    const context = [
      '\n --- Source 1: Burj Khalifa - Wikipedia --- \n 828 m \n',
    ];
    const sourceDocuments: SourceDocument[] = [
      {
        kind: 'web',
        name: 'Burj Khalifa - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Burj_Khalifa',
        read: true,
      },
    ];
    const messages = [
      { id: 1, chatId: 1, role: 'user', content: question, timestamp: 0 },
    ] as Message[];
    const settings = {
      systemPrompt: '',
      thinkingEnabled: false,
    } as ChatSettings;
    const prepared = prepareMessagesForLLM(
      messages,
      context,
      settings,
      baseModel,
      { sourceDocuments }
    );
    const assembled = String(prepared[0].content).length;
    const reserved =
      getPromptCharBudget(baseModel, question) -
      webContextCharBudget(baseModel, [], '', question)!;

    expect(reserved).toBeGreaterThanOrEqual(assembled);
  });

  it('never drops below the minimum snippet size, even under heavy pressure', () => {
    const hugeSystemPrompt = 'x'.repeat(getPromptCharBudget(baseModel) * 5);
    expect(webContextCharBudget(baseModel, [], hugeSystemPrompt)).toBe(
      WEB_SNIPPET_MAX_CHARS
    );
  });
});
