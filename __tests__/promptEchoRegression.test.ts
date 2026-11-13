import { prepareMessagesForLLM } from '../utils/promptUtils';
import { buildMessageSources, type SourceRow } from '../utils/messageSources';
import { webResultsToContext } from '../utils/web/webResultsToContext';
import { hybridRetrieve } from '../utils/hybridRetrieval';
import { stripSpecialTokens } from '../utils/specialTokens';
import { parseThinkingContent } from '../utils/thinking';
import {
  ChatSettings,
  Message,
  SourceDocument,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import type { WebSearchResult } from '../utils/web/types';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

jest.mock('../utils/hybridRetrieval', () => ({
  hybridRetrieve: jest.fn(),
}));

const mockHybridRetrieve = hybridRetrieve as jest.Mock;

const settings = {
  systemPrompt:
    'You are a knowledgeable and helpful assistant. Provide clear, accurate, and well-structured responses.',
  thinkingEnabled: true,
} as ChatSettings;

const model: Model = {
  id: 1,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
  thinking: true,
};

let nextId = 1;
const turn = (role: Message['role'], content: string): Message => ({
  id: nextId++,
  chatId: 1,
  role,
  content,
  timestamp: 1_700_000_000_000,
});

const conversation = (...userTurns: string[]): Message[] => [
  ...userTurns.flatMap((text, index) =>
    index < userTurns.length - 1
      ? [turn('user', text), turn('assistant', 'Sure, here you go.')]
      : [turn('user', text)]
  ),
  turn('assistant', ''),
];

const GUIDE_TEXT =
  'Take screenshots on a clean status bar at 9:41. Export them at 1290 x 2796 pixels for the 6.9-inch display.';

const guide: SourceRow = {
  id: 7,
  name: 'ios-screenshots-guide.txt',
  firstChunk: 'App Store screenshot guide. ' + GUIDE_TEXT,
};

const longReport: SourceRow = {
  id: 8,
  name: 'quarterly-report.txt',
  firstChunk: 'Quarterly report, overview section. '.repeat(40),
};

const eiffel: WebSearchResult = {
  title: 'Eiffel Tower — Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
  snippet: 'Wrought-iron lattice tower in Paris.',
  content:
    'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, completed in 1889 for the World Fair. It is 330 metres tall.',
};

const headphones: WebSearchResult = {
  title: 'Sony WH-1000XM6 — Store',
  url: 'https://store.example.com/wh-1000xm6',
  snippet: 'Wireless noise cancelling headphones.',
  content:
    'The WH-1000XM6 are wireless noise cancelling headphones with 30 hours of battery life.',
  product: { name: 'WH-1000XM6', price: '449', currency: 'USD' },
};

const vectorStore = {} as OPSQLiteVectorStore;

const attachedDocument = async (source: SourceRow, passage: string) => {
  mockHybridRetrieve.mockResolvedValueOnce([
    {
      document: passage,
      similarity: 0.8,
      metadata: { documentId: source.id, name: source.name },
    },
  ]);
  const built = await buildMessageSources({
    userInput: 'question about the file',
    attachmentSourceIds: [source.id],
    enabledSources: [source.id],
    sources: [source],
    vectorStore,
  });
  return {
    context: built.context,
    sourceDocuments: built.sourceDocuments,
    preferredSourceDocuments: built.preferredSourceDocuments,
  };
};

const webSearch = (results: WebSearchResult[], query: string, offset = 0) => {
  const built = webResultsToContext(results, query, offset);
  return {
    context: built.context,
    sourceDocuments: built.sourceDocuments as SourceDocument[],
  };
};

interface Prompt {
  messages: Message[];
  context: string[];
  sourceDocuments?: SourceDocument[];
  preferredSourceDocuments?: SourceDocument[];
  customSystemPrompt?: string;
  digest?: string;
  webIntentKind?: 'comparison';
  webSubQueries?: string[];
}

interface Scenario {
  name: string;
  build: () => Promise<Prompt>;
}

const scenarios: Scenario[] = [
  {
    name: 'a question about an attached document',
    build: async () => ({
      messages: conversation('Summarize this file'),
      ...(await attachedDocument(guide, GUIDE_TEXT)),
    }),
  },
  {
    name: 'a web search answer',
    build: async () => ({
      messages: conversation('When was the Eiffel Tower built?'),
      ...webSearch([eiffel], 'Eiffel Tower built'),
    }),
  },
  {
    name: 'a product price from the web',
    build: async () => ({
      messages: conversation('How much are the Sony WH-1000XM6?'),
      ...webSearch([headphones], 'Sony WH-1000XM6 price'),
    }),
  },
  {
    name: 'a comparison split into planned sub-queries',
    build: async () => ({
      messages: conversation('Compare the Eiffel Tower and the WH-1000XM6'),
      ...webSearch([eiffel, headphones], 'compare'),
      webIntentKind: 'comparison',
      webSubQueries: ['Eiffel Tower height', 'WH-1000XM6 price'],
    }),
  },
  {
    name: 'a document and the web together, in a follow-up with a digest',
    build: async () => {
      const document = await attachedDocument(guide, GUIDE_TEXT);
      const web = webSearch([eiffel], 'Eiffel Tower height', 1);
      return {
        messages: conversation(
          'What size should the screenshots be?',
          'And how tall is the Eiffel Tower?'
        ),
        context: [...document.context, ...web.context],
        sourceDocuments: [...document.sourceDocuments, ...web.sourceDocuments],
        preferredSourceDocuments: document.preferredSourceDocuments,
        digest: 'Topic: App Store screenshot sizes.',
      };
    },
  },
  {
    name: 'a long document trimmed to fit the context window',
    build: async () => ({
      messages: conversation('What does the report say?'),
      ...(await attachedDocument(
        longReport,
        'Revenue grew in every region this quarter. '.repeat(400)
      )),
    }),
  },
  {
    name: 'a question in Polish with no sources',
    build: async () => ({
      messages: conversation('Jaka jest stolica Francji?'),
      context: [],
    }),
  },
  {
    name: 'a chat with personal preferences',
    build: async () => ({
      messages: conversation('Tell me a fact about Paris'),
      context: [],
      customSystemPrompt: 'Always start the answer with the word Banana.',
    }),
  },
];

const STRUCTURAL_MARKER =
  /<\/?[a-z_]{3,24}>|--- [^\n]{1,160}? ---|\(Answer in [^()\n]{1,60}\.\)|\[[A-Z][a-z]+(?: [a-z]+)+(?::[^\]\n]*)?\]/g;

const promptText = async (scenario: Scenario) => {
  const { messages, context, ...options } = await scenario.build();
  return prepareMessagesForLLM(messages, context, settings, model, options)
    .map((message) => message.content)
    .join('\n');
};

const hiddenMarkersOf = async (scenario: Scenario): Promise<string[]> => {
  const prompt = await promptText(scenario);
  return [...new Set(prompt.match(STRUCTURAL_MARKER) ?? [])].filter(
    (marker) => !/^<\/?think>$/.test(marker)
  );
};

const thinkingReply = (markers: string[]) => {
  const quoted = markers.map((marker) => `"${marker}"`).join(' and ');
  return [
    '<think>',
    `Let me reread the instruction: ${quoted}.`,
    ...markers,
    'So the user wants a short answer.',
    '</think>',
    `<answer>Here is the answer. ${markers.join(' ')}`,
    ...markers,
    'That is all.</answer>',
  ].join('\n');
};

const plainReply = (markers: string[]) =>
  [`Here is the answer. ${markers.join(' ')}`, ...markers, 'That is all.'].join(
    '\n'
  );

const withoutAngleBrackets = (markers: string[]) =>
  markers.filter((marker) => !marker.includes('<'));

const shownToUser = (storedReply: string) => {
  const parts = parseThinkingContent(stripSpecialTokens(storedReply));
  return {
    thinking: parts.thinkingContent ?? '',
    answer: `${parts.normalContent}${parts.normalAfterThink ?? ''}`,
  };
};

const leakedMarkers = (shown: string, markers: string[]) =>
  markers.filter((marker) => shown.includes(marker));

const cases = scenarios.map((scenario) => [scenario.name, scenario] as const);

describe('a reply that echoes the hidden prompt shows none of it', () => {
  beforeEach(() => mockHybridRetrieve.mockReset());

  it.each(cases)(
    '%s: the prompt carries structural markers the model can copy',
    async (_name, scenario) => {
      expect((await hiddenMarkersOf(scenario)).length).toBeGreaterThan(0);
    }
  );

  it.each(cases)(
    '%s: none of them reach the thinking or the answer',
    async (_name, scenario) => {
      const markers = await hiddenMarkersOf(scenario);
      const { thinking, answer } = shownToUser(thinkingReply(markers));

      expect({ thinking: leakedMarkers(thinking, markers) }).toEqual({
        thinking: [],
      });
      expect({ answer: leakedMarkers(answer, markers) }).toEqual({
        answer: [],
      });
      expect(answer).toContain('Here is the answer.');
      expect(answer).toContain('That is all.');
      expect(thinking).toContain('So the user wants a short answer.');
    }
  );

  it.each(cases)(
    '%s: none of them reach an answer written with thinking off',
    async (_name, scenario) => {
      const markers = withoutAngleBrackets(await hiddenMarkersOf(scenario));
      const { answer } = shownToUser(plainReply(markers));

      expect({ answer: leakedMarkers(answer, markers) }).toEqual({
        answer: [],
      });
      expect(answer).toContain('Here is the answer.');
      expect(answer).toContain('That is all.');
    }
  );

  it('keeps a marker the user asked about inside a code span', () => {
    const reply = 'Wrap it like `<sources>` and `--- Source 1: a.txt ---`.';
    expect(shownToUser(reply).answer).toBe(reply);
  });

  it('keeps a markdown rule and an em dash aside, which only look like a delimiter', () => {
    const reply = 'Intro\n\n---\n\nThe tower — built in 1889 — still stands.';
    expect(shownToUser(reply).answer).toBe(reply);
  });

  it('keeps an answer that merely talks about answering in a language', () => {
    const reply = 'You can ask me to answer in Polish at any time.';
    expect(shownToUser(reply).answer).toBe(reply);
  });

  it('keeps a bracketed note that is not the product marker', () => {
    const reply = 'The price is $449 [as of today] according to the store.';
    expect(shownToUser(reply).answer).toBe(reply);
  });
});
