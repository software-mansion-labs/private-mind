import { prepareMessagesForLLM } from '../utils/promptUtils';
import {
  estimatePromptTokens,
  getPromptTokenBudget,
} from '../constants/context-window';
import { updateConversationDigest } from '../utils/conversationDigest';
import { carryReferentIntoQuery } from '../utils/web/buildSearchQuery';
import type { Message, SourceDocument } from '../database/chatRepository';
import type { Model } from '../database/modelRepository';
import type { ChatSettings } from '../database/chatRepository';

const model = {
  id: 1,
  modelName: 'Test LLM',
  source: 'remote',
  isDownloaded: true,
  modelPath: 'm',
  tokenizerPath: 't',
  tokenizerConfigPath: 'tc',
  thinking: false,
} as Model;

const settings = {
  systemPrompt: 'You are a helpful assistant.',
  contextWindow: 2048,
  thinkingEnabled: false,
} as ChatSettings;

const webSources: SourceDocument[] = [
  { name: 'Euro', kind: 'web', url: 'https://euro.com.pl' },
];

const QUESTIONS = [
  'Ile kosztuje Samsung Galaxy S25 w Polsce?',
  'A jaki ma aparat?',
  'Ile ma pamięci RAM?',
  'Czy jest dostępny w kolorze czarnym?',
  'Jaka jest jego waga?',
  'A jakie ma wymiary?',
  'Czy warto go kupić?',
  'Jaki ma procesor?',
  'Ile trwa ładowanie baterii?',
  'Czy ma gniazdo słuchawkowe?',
];

const conversation = (turns: number): Message[] => {
  const messages: Message[] = [];
  for (let turn = 0; turn < turns; turn++) {
    messages.push({
      id: messages.length + 1,
      chatId: 1,
      role: 'user',
      content: QUESTIONS[turn % QUESTIONS.length]!,
      timestamp: turn,
    });
    messages.push({
      id: messages.length + 1,
      chatId: 1,
      role: 'assistant',
      content: `Odpowiedź numer ${turn + 1}. ${'Szczegóły techniczne modelu opisane w źródłach. '.repeat(6)}`,
      timestamp: turn,
    });
  }
  messages.push({
    id: messages.length + 1,
    chatId: 1,
    role: 'user',
    content: 'A ile kosztuje wersja 512GB?',
    timestamp: turns,
  });
  messages.push({
    id: messages.length + 1,
    chatId: 1,
    role: 'assistant',
    content: '',
    timestamp: turns,
  });
  return messages;
};

const prepare = (turns: number, digest?: string) =>
  prepareMessagesForLLM(
    conversation(turns),
    ['\n --- Source 1: Euro --- \n price=4199 PLN \n --- End of Source 1 ---'],
    settings,
    model,
    { sourceDocuments: webSources, ...(digest ? { digest } : {}) }
  );

const LENGTHS = [1, 2, 4, 8, 16, 32, 64];

describe('a conversation that outgrows the context window', () => {
  it.each(LENGTHS)('stays inside the token budget at %i turns', (turns) => {
    const assembled = prepare(turns)
      .map((message) => String(message.content))
      .join(' ');
    expect(estimatePromptTokens(assembled)).toBeLessThanOrEqual(
      getPromptTokenBudget(model)
    );
  });

  it.each(LENGTHS)(
    'always keeps the system prompt and the question (%i turns)',
    (turns) => {
      const prepared = prepare(turns);
      expect(prepared[0]!.role).toBe('system');
      expect(String(prepared.at(-1)!.content)).toContain(
        'A ile kosztuje wersja 512GB?'
      );
    }
  );

  it.each(LENGTHS)(
    'keeps an unbroken tail, shortening only older replies (%i turns)',
    (turns) => {
      const full = conversation(turns);
      const prepared = prepare(turns);
      const kept = prepared.slice(1, -1);
      if (kept.length === 0) return;
      const original = full.slice(0, -2);
      const tail = original.slice(original.length - kept.length);

      expect(tail).toHaveLength(kept.length);
      kept.forEach((message, index) => {
        const source = tail[index]!;
        expect(message.role).toBe(source.role);
        if (message.role === 'user') {
          expect(message.content).toBe(source.content);
          return;
        }
        const content = String(message.content);
        expect(source.content.startsWith(content.replace(/…$/, ''))).toBe(true);
      });
    }
  );

  it('shortens older replies rather than dropping whole turns (compaction)', () => {
    const compacted = prepare(16);
    const replies = compacted
      .slice(1, -1)
      .filter((message) => message.role === 'assistant')
      .map((message) => String(message.content));

    expect(replies.length).toBeGreaterThan(1);
    expect(replies.at(-1)).not.toMatch(/…$/);
    expect(replies.slice(0, -1).some((reply) => reply.endsWith('…'))).toBe(
      true
    );
  });

  it('never opens the kept history with an assistant reply whose question was cut', () => {
    for (const turns of LENGTHS) {
      const prepared = prepare(turns);
      const kept = prepared.slice(1, -1);
      if (kept.length === 0) continue;
      expect(kept[0]!.role).toBe('user');
    }
  });

  it('drops turns once the conversation is long, and carries the digest instead', () => {
    const digest = 'cena i specyfikacja Samsung Galaxy S25';
    const short = prepare(1, digest);
    const long = prepare(32, digest);

    expect(String(short[0]!.content)).not.toContain(digest);
    expect(String(long[0]!.content)).toContain(digest);
    expect(long.length).toBeLessThan(32 * 2 + 2);
  });

  it('does not grow the prompt as the conversation grows, once it is saturated', () => {
    const sizes = [16, 32, 64].map(
      (turns) =>
        prepare(turns, 'cena Samsung Galaxy S25')
          .map((message) => String(message.content))
          .join(' ').length
    );
    const spread = Math.max(...sizes) - Math.min(...sizes);
    expect(spread).toBeLessThan(200);
  });
});

describe('the digest across a long conversation', () => {
  it('keeps naming the subject after ten turns of follow-ups', async () => {
    let digest: string | null = null;
    const generate = jest.fn(async (messages) => {
      const latest = String(messages.at(-1)?.content ?? '');
      const question = latest.match(/User: (.*)/)?.[1] ?? '';
      return question.includes('Samsung')
        ? 'cena Samsung Galaxy S25 w Polsce'
        : 'Samsung Galaxy S25, specyfikacja techniczna';
    });

    for (const question of QUESTIONS) {
      digest = await updateConversationDigest(
        generate,
        digest,
        question,
        'Szczegóły techniczne modelu opisane w źródłach.'
      );
    }

    expect(digest).toContain('Samsung Galaxy S25');
    expect(digest!.length).toBeLessThanOrEqual(200);
  });

  it('holds on to the previous topic when a turn produces nothing usable', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce('cena Samsung Galaxy S25')
      .mockResolvedValueOnce('<think>')
      .mockResolvedValueOnce('   ');

    let digest = await updateConversationDigest(
      generate,
      null,
      'Ile kosztuje Samsung Galaxy S25?',
      'Kosztuje 4199 zł.'
    );
    for (const question of ['A jaki ma aparat?', 'A ile waży?']) {
      digest = await updateConversationDigest(
        generate,
        digest,
        question,
        'Odpowiedź.'
      );
    }
    expect(digest).toBe('cena Samsung Galaxy S25');
  });
});

describe('a long conversation that changes subject halfway', () => {
  const PHONE_TURNS = [
    'Ile kosztuje Samsung Galaxy S25 w Polsce?',
    'A jaki ma aparat?',
    'Ile ma pamięci RAM?',
    'Czy jest dostępny w kolorze czarnym?',
    'Jaka jest jego waga?',
  ];
  const WEATHER_TURNS = [
    'Jaka będzie pogoda w Nowym Sączu jutro?',
    'A pojutrze?',
    'Czy będzie padać?',
  ];

  const digestAcross = async (
    questions: string[],
    topicFor: (question: string) => string
  ): Promise<string | null> => {
    const generate = jest.fn(async (messages) => {
      const latest = String(messages.at(-1)?.content ?? '');
      return topicFor(latest.match(/User: (.*)/)?.[1] ?? '');
    });
    let digest: string | null = null;
    for (const question of questions) {
      digest = await updateConversationDigest(
        generate,
        digest,
        question,
        'Odpowiedź na podstawie źródeł.'
      );
    }
    return digest;
  };

  const topicFor = (question: string): string =>
    /pogod|padać|pojutrze/i.test(question)
      ? 'prognoza pogody Nowy Sącz'
      : 'cena i specyfikacja Samsung Galaxy S25';

  it('lets the digest follow the new subject instead of freezing on the old one', async () => {
    const digest = await digestAcross(
      [...PHONE_TURNS, ...WEATHER_TURNS],
      topicFor
    );

    expect(digest).toContain('Nowy Sącz');
    expect(digest).not.toContain('Galaxy S25');
  });

  it('still holds the old subject while the conversation is still on it', async () => {
    const digest = await digestAcross(PHONE_TURNS, topicFor);

    expect(digest).toContain('Galaxy S25');
  });

  it('does not splice a stale subject into a query that names its own', () => {
    const history = [
      { role: 'user', content: 'Ile kosztuje Samsung Galaxy S25?' },
      { role: 'assistant', content: 'Samsung Galaxy S25 kosztuje 2499 zł.' },
    ];

    expect(
      carryReferentIntoQuery(
        'Jaka będzie pogoda w Nowym Sączu jutro?',
        history,
        'cena i specyfikacja Samsung Galaxy S25'
      )
    ).not.toContain('Galaxy');
  });

  it('carries the new subject, not the old one, once the digest has moved on', () => {
    const history = [
      { role: 'user', content: 'Jaka będzie pogoda w Nowym Sączu jutro?' },
      { role: 'assistant', content: 'Jutro w Nowym Sączu będzie 22°C.' },
    ];

    const carried = carryReferentIntoQuery(
      'A pojutrze?',
      history,
      'prognoza pogody Nowy Sącz'
    );
    expect(carried).not.toContain('Galaxy');
    expect(carried).toContain('Nowy');
  });
});
