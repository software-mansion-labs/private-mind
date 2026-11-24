jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import * as modelProfiles from '../constants/model-profiles';
import { RECALL_BLOCK_HEADER } from '../constants/conversation-memory';
import {
  WEB_FIRST_TURN_SOURCE_CAP_TOKENS,
  estimatePromptTokens,
} from '../constants/context-window';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import { runWebSearch } from '../utils/web/runWebSearch';
import { clearWebCaches } from '../utils/web/cache/webCache';
import type { WebSearchProvider } from '../utils/web/types';
import type {
  ChatSettings,
  ConversationMemoryStats,
  Message,
} from '../database/chatRepository';
import type { Model } from '../database/modelRepository';

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
  thinkingEnabled: false,
} as ChatSettings;

const FACT_QUESTION = 'My dog is called Burek and he is nine years old.';
const ASKED = 'What is the name of my dog?';
const QUESTION = 'Who founded Zorblax Industries?';
const PAGE_TEXT = `Zorblax Industries was founded by Ada Quill in 1987. ${'Компания с богатой историей и большим числом сотрудников. '.repeat(40)}`;

const message = (
  id: number,
  role: 'user' | 'assistant',
  content: string
): Message => ({ id, chatId: 1, role, content, timestamp: id });

const longChat = (): Message[] => {
  const messages: Message[] = [
    message(1, 'user', FACT_QUESTION),
    message(2, 'assistant', 'Lovely to meet Burek!'),
  ];
  for (let turn = 0; turn < 70; turn++) {
    const id = messages.length + 1;
    messages.push(
      message(
        id,
        'user',
        `Forecast request ${turn}: ${'clear sky '.repeat(8)}`
      ),
      message(
        id + 1,
        'assistant',
        `Forecast ${turn}: ${'warm breeze '.repeat(8)}`
      )
    );
  }
  messages.push(message(messages.length + 1, 'user', ASKED));
  return messages;
};

const recallFor = (answersFromDocument: boolean) => {
  let stats: ConversationMemoryStats | undefined;
  const prompt = prepareMessagesForLLM(longChat(), [], settings, model, {
    answersFromDocument,
    onConversationMemory: (reported) => {
      stats = reported;
    },
  });
  return { system: String(prompt[0]!.content), stats };
};

const provider: WebSearchProvider = {
  id: 'mock',
  isReady: () => true,
  search: async () =>
    [0, 1, 2, 3].map((index) => ({
      title: `Zorblax source ${index}`,
      url: `https://${index}.example/zorblax`,
      snippet: 'Zorblax Industries founder',
      content: PAGE_TEXT,
    })),
};

const firstTurnSearch = (answersFromDocument: boolean) =>
  runWebSearch({
    query: QUESTION,
    history: [],
    provider,
    embeddings: null,
    embeddingModelReady: false,
    generate: async () => '',
    profile: modelProfiles.DEFAULT_PROFILE,
    contextCharBudget: 60_000,
    answersFromDocument,
  });

const tokensOf = (context: string[]): number =>
  context.reduce((sum, block) => sum + estimatePromptTokens(block), 0);

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(modelProfiles, 'getModelProfile').mockReturnValue({
    ...modelProfiles.DEFAULT_PROFILE,
    contextWindowTokens: 4096,
    generationReserveTokens: modelProfiles.scaledGenerationReserve(4096),
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('a web or plain conversation turn', () => {
  it('recalls the dropped turn that answers the question, lexically', () => {
    const { system, stats } = recallFor(false);

    expect(system).toContain(RECALL_BLOCK_HEADER);
    expect(system).toContain(`User: ${FACT_QUESTION}`);
    expect(stats!.recallMode).toBe('lexical');
  });

  it('caps its first-turn web sources', async () => {
    const { context, telemetry } = await firstTurnSearch(false);

    expect(tokensOf(context)).toBeLessThanOrEqual(
      WEB_FIRST_TURN_SOURCE_CAP_TOKENS
    );
    expect(telemetry.droppedByCap).toBeGreaterThan(0);
  });
});

describe('a turn that answers from an attached document', () => {
  it('recalls nothing and reports no memory stats', () => {
    const { system, stats } = recallFor(true);

    expect(system).not.toContain(RECALL_BLOCK_HEADER);
    expect(stats).toBeUndefined();
  });

  it('keeps its first-turn web sources uncapped', async () => {
    const { context, telemetry } = await firstTurnSearch(true);

    expect(tokensOf(context)).toBeGreaterThan(WEB_FIRST_TURN_SOURCE_CAP_TOKENS);
    expect(telemetry.droppedByCap).toBeUndefined();
  });
});
