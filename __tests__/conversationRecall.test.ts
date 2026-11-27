import * as modelProfiles from '../constants/model-profiles';
import { questionTurnOf } from '../utils/answerLanguageTurn';
import {
  estimatePromptTokens,
  getConversationTokenBudget,
} from '../constants/context-window';
import {
  RECALL_BLOCK_HEADER,
  RECALL_MIN_KEPT_SHARE,
} from '../constants/conversation-memory';
import { prepareMessagesForLLM } from '../utils/promptUtils';
import { conversationWindowFor } from '../utils/conversationWindow';
import {
  bestWindow,
  questionTermsFor,
  weightedCoverage,
} from '../utils/recall/recallTerms';
import {
  recallShareFor,
  selectRecalledMessages,
  withoutLeastRanked,
  type RecalledMessage,
} from '../utils/recall/recallSelection';
import {
  createRecallEmbeddingCache,
  embedConversationForRecall,
  recallEmbeddingPool,
  type RecallEmbedder,
} from '../utils/recall/recallEmbeddings';
import { retrievalStatsLines } from '../utils/retrievalStatsLine';
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
const FACT_REPLY = 'Lovely to meet Burek!';
const ASKED = 'What is the name of my dog?';
const FILLER_TURNS = 70;

const windowTokens = [2048, 4096, 8192] as const;

const withWindow = (tokens: number) =>
  jest.spyOn(modelProfiles, 'getModelProfile').mockReturnValue({
    ...modelProfiles.DEFAULT_PROFILE,
    contextWindowTokens: tokens,
    generationReserveTokens: modelProfiles.scaledGenerationReserve(tokens),
  });

const message = (
  id: number,
  role: 'user' | 'assistant',
  content: string
): Message => ({ id, chatId: 1, role, content, timestamp: id });

const longChat = (question: string, turns = FILLER_TURNS): Message[] => {
  const messages: Message[] = [
    message(1, 'user', FACT_QUESTION),
    message(2, 'assistant', FACT_REPLY),
  ];
  for (let turn = 0; turn < turns; turn++) {
    const id = messages.length + 1;
    messages.push(
      message(
        id,
        'user',
        `Forecast request ${turn}: sunny skies and light winds over the valley today, ${'clear horizon '.repeat(8)}`
      ),
      message(
        id + 1,
        'assistant',
        `Forecast ${turn}: ${'warm afternoon with a gentle breeze from the west '.repeat(5)}`
      )
    );
  }
  messages.push(message(messages.length + 1, 'user', question));
  return messages;
};

const prepare = (
  chat: Message[],
  options: Parameters<typeof prepareMessagesForLLM>[4] = {}
) => {
  let stats: ConversationMemoryStats | undefined;
  const prompt = prepareMessagesForLLM(chat, [], settings, model, {
    ...options,
    onConversationMemory: (reported) => {
      stats = reported;
    },
  });
  return { prompt, stats };
};

const allText = (prompt: { content: unknown }[]) =>
  prompt.map((entry) => String(entry.content)).join(' ');

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(windowTokens)(
  'conversationRecall at a %i token window',
  (tokens) => {
    beforeEach(() => {
      withWindow(tokens);
    });

    it('puts the dropped turn that holds the fact back, word for word', () => {
      const { prompt, stats } = prepare(longChat(ASKED));
      const system = String(prompt[0]!.content);

      expect(system).toContain(RECALL_BLOCK_HEADER);
      expect(system).toContain(`User: ${FACT_QUESTION}`);
      expect(stats!.messagesRecalled).toBeGreaterThan(0);
      expect(stats!.turnsDropped).toBeGreaterThan(0);
    });

    it('recalls nothing for a turn that answers from an attached document', () => {
      const { prompt, stats } = prepare(longChat(ASKED), {
        answersFromDocument: true,
      });

      expect(String(prompt[0]!.content)).not.toContain(RECALL_BLOCK_HEADER);
      expect(stats).toBeUndefined();
    });

    it('keeps the recalled pair in chronological order, reply after question', () => {
      const { prompt } = prepare(longChat(ASKED));
      const system = String(prompt[0]!.content);

      const asked = system.indexOf(`User: ${FACT_QUESTION}`);
      const reply = system.indexOf(`Assistant: ${FACT_REPLY}`);
      expect(asked).toBeGreaterThan(-1);
      expect(reply).toBeGreaterThan(asked);
    });

    it('leaves the last user message intact and the chat turns after the recalled block', () => {
      const { prompt } = prepare(longChat(ASKED));

      expect(prompt[0]!.role).toBe('system');
      expect(questionTurnOf(prompt)!.role).toBe('user');
      expect(String(questionTurnOf(prompt)!.content).startsWith(ASKED)).toBe(
        true
      );
      expect(prompt[1]!.role).toBe('user');
    });

    it('never lets the prompt outgrow the conversation budget', () => {
      const { prompt } = prepare(longChat(ASKED));
      const budget = getConversationTokenBudget(
        model,
        conversationWindowFor(model, { memory: 'auto' })
      );

      expect(estimatePromptTokens(allText(prompt))).toBeLessThanOrEqual(budget);
    });

    it('caps the recalled block at the window share', () => {
      const { stats } = prepare(longChat(ASKED));
      const budget = getConversationTokenBudget(
        model,
        conversationWindowFor(model, { memory: 'auto' })
      );

      expect(stats!.recallTokens).toBeLessThanOrEqual(
        Math.ceil(budget * recallShareFor(tokens))
      );
    });

    it('recalls nothing when nothing was dropped', () => {
      const short = [
        message(1, 'user', FACT_QUESTION),
        message(2, 'assistant', FACT_REPLY),
        message(3, 'user', ASKED),
      ];
      const { prompt, stats } = prepare(short);

      expect(String(prompt[0]!.content)).not.toContain(RECALL_BLOCK_HEADER);
      expect(stats).toMatchObject({ turnsDropped: 0, messagesRecalled: 0 });
    });

    it('recalls nothing when no dropped turn is about the question', () => {
      const { prompt, stats } = prepare(
        longChat('Explain quantum chromodynamics briefly')
      );

      expect(String(prompt[0]!.content)).not.toContain(RECALL_BLOCK_HEADER);
      expect(stats).toMatchObject({ messagesRecalled: 0, recallMode: 'none' });
      expect(stats!.turnsDropped).toBeGreaterThan(0);
    });

    it('reports a lexical-only turn when no embedder scores were supplied', () => {
      const { stats } = prepare(longChat(ASKED));

      expect(stats!.recallMode).toBe('lexical');
    });
  }
);

describe('conversationRecall with embedding scores', () => {
  beforeEach(() => {
    withWindow(4096);
  });

  it('fuses embedding similarity and recalls a paraphrase with no shared word', () => {
    const chat = longChat('Which pet do I have at home?');
    const similarities = new Map<number, number>([[1, 0.6]]);
    const { prompt, stats } = prepare(chat, {
      recallSimilarities: similarities,
    });

    expect(String(prompt[0]!.content)).toContain(`User: ${FACT_QUESTION}`);
    expect(stats!.recallMode).toBe('fused');
  });

  it('ignores a similarity below the floor', () => {
    const chat = longChat('Which pet do I have at home?');
    const { prompt } = prepare(chat, {
      recallSimilarities: new Map<number, number>([[1, 0.1]]),
    });

    expect(String(prompt[0]!.content)).not.toContain(RECALL_BLOCK_HEADER);
  });
});

describe('conversationRecall alongside sources and reload', () => {
  beforeEach(() => {
    withWindow(4096);
  });

  it('keeps the sources block on the last message and strips citation markers from recalled replies', () => {
    const chat = longChat(ASKED);
    chat[1] = message(2, 'assistant', `${FACT_REPLY} Burek is a dog [1].`);
    const prompt = prepareMessagesForLLM(
      chat,
      ['--- Source 1: doc --- \n body \n --- End of Source 1 ---'],
      settings,
      model,
      { sourceDocuments: [{ name: 'doc', passage: 'body' }] }
    );

    expect(String(questionTurnOf(prompt)!.content)).toContain('<sources>');
    expect(String(prompt[0]!.content)).toContain(
      `Assistant: ${FACT_REPLY} Burek is a dog.`
    );
    expect(String(prompt[0]!.content)).not.toContain('[1]');
  });

  it('works from rows with no in-memory-only fields', () => {
    const chat = longChat(ASKED).map(
      ({ id, chatId, role, content, timestamp }) => ({
        id,
        chatId,
        role,
        content,
        timestamp,
      })
    ) as Message[];
    const { stats } = prepare(chat);

    expect(stats!.messagesRecalled).toBeGreaterThan(0);
  });

  it('keeps room for the recent turns even at the largest recall share', () => {
    expect(1 - recallShareFor(8192)).toBeGreaterThanOrEqual(
      RECALL_MIN_KEPT_SHARE
    );
  });
});

describe('conversationRecall on a turn that answers from an attached document', () => {
  it('builds the same prompt with or without similarity scores and reports nothing', () => {
    withWindow(4096);
    const chat = longChat(ASKED);
    const reported = jest.fn();
    const plain = prepareMessagesForLLM(chat, [], settings, model, {
      answersFromDocument: true,
    });
    const scored = prepareMessagesForLLM(chat, [], settings, model, {
      answersFromDocument: true,
      recallSimilarities: new Map([[1, 0.9]]),
      onConversationMemory: reported,
    });

    expect(scored).toEqual(plain);
    expect(String(plain[0]!.content)).not.toContain(RECALL_BLOCK_HEADER);
    expect(reported).not.toHaveBeenCalled();
  });
});

describe('embedConversationForRecall', () => {
  const embedderWith = (loaded: boolean) => {
    const embedDocument = jest.fn(async () => [1, 0]);
    const embedQuery = jest.fn(async () => [1, 0]);
    const embedder: RecallEmbedder = {
      isLoaded: () => loaded,
      embedDocument,
      embedQuery,
    };
    return { embedder, embedDocument, embedQuery };
  };
  const messages = longChat(ASKED, 3).slice(0, -1);

  it('returns null without touching the embedder when it is not loaded', async () => {
    const { embedder, embedDocument } = embedderWith(false);

    expect(
      await embedConversationForRecall({
        messages,
        question: ASKED,
        embedder,
        cache: createRecallEmbeddingCache(),
      })
    ).toBeNull();
    expect(embedDocument).not.toHaveBeenCalled();
  });

  it('does not embed a message again on the next turn', async () => {
    const { embedder, embedDocument } = embedderWith(true);
    const cache = createRecallEmbeddingCache();

    await embedConversationForRecall({
      messages,
      question: ASKED,
      embedder,
      cache,
    });
    const firstTurnCalls = embedDocument.mock.calls.length;
    await embedConversationForRecall({
      messages,
      question: 'And how old is he?',
      embedder,
      cache,
    });

    expect(firstTurnCalls).toBeGreaterThan(0);
    expect(embedDocument).toHaveBeenCalledTimes(firstTurnCalls);
  });

  it('splits a long message into windows the embedder accepts', async () => {
    const { embedder, embedDocument } = embedderWith(true);
    const long = [message(1, 'user', 'word '.repeat(1200))];

    await embedConversationForRecall({
      messages: long,
      question: ASKED,
      embedder,
      cache: createRecallEmbeddingCache(),
    });

    expect(embedDocument.mock.calls.length).toBeGreaterThan(1);
  });

  it('bounds the cache and the work per turn', async () => {
    const { embedder, embedDocument } = embedderWith(true);
    const cache = createRecallEmbeddingCache(2);

    await embedConversationForRecall({
      messages,
      question: ASKED,
      embedder,
      cache,
      perTurnCap: 3,
    });

    expect(embedDocument).toHaveBeenCalledTimes(3);
    expect(cache.size()).toBe(2);
  });

  it('returns null when the embedder throws, so the turn stays lexical', async () => {
    const { embedder, embedQuery } = embedderWith(true);
    embedQuery.mockRejectedValueOnce(new Error('boom'));

    expect(
      await embedConversationForRecall({
        messages,
        question: ASKED,
        embedder,
        cache: createRecallEmbeddingCache(),
      })
    ).toBeNull();
  });
});

describe('matching question terms in a recalled message', () => {
  it('matches a term only where a word starts, not inside another word', () => {
    const terms = questionTermsFor('Which part did I order?');

    expect(
      weightedCoverage('The apartment is near the department store.', terms)
    ).toBe(0);
    expect(weightedCoverage('You ordered the spare part.', terms)).toBe(
      weightedCoverage('You ordered the part.', terms)
    );
  });

  it('recalls nothing when the only overlap sits inside other words', () => {
    const selection = selectRecalledMessages({
      candidates: [
        {
          index: 0,
          role: 'user',
          text: 'My apartment is next to the department store.',
        },
      ],
      question: 'Which part did I order?',
      charRoom: 2000,
      tokenRoom: 2000,
    });

    expect(selection.items).toEqual([]);
  });
});

describe('choosing the window of a long recalled message', () => {
  const longMessage = (sentence: string, target: string, separator: string) =>
    [...Array.from({ length: 60 }, () => sentence), target].join(separator);

  it.each([
    {
      script: 'Devanagari',
      text: longMessage(
        'आज मौसम बहुत अच्छा था और हम पार्क में घूमे',
        'मेरे कुत्ते का नाम बुरेक है',
        '। '
      ),
      question: 'मेरे कुत्ते का नाम क्या है?',
      target: 'बुरेक',
    },
    {
      script: 'Urdu',
      text: longMessage(
        'آج موسم بہت اچھا تھا اور ہم پارک گئے',
        'میرے کتے کا نام بوریک ہے',
        '۔ '
      ),
      question: 'میرے کتے کا نام کیا ہے؟',
      target: 'بوریک',
    },
    {
      script: 'Chinese',
      text: longMessage('今天天气很好我们去了公园散步', '我的狗叫布雷克', '。'),
      question: '我的狗叫什么？',
      target: '布雷克',
    },
  ])(
    'splits $script text at its own sentence marks',
    ({ text, question, target }) => {
      const window = bestWindow(text, questionTermsFor(question));

      expect(window.text).toContain(target);
    }
  );
});

describe('trimming the recalled block', () => {
  const recalled = (
    index: number,
    rank: number,
    partner: boolean
  ): RecalledMessage => ({
    index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    text: `message ${index}`,
    rank,
    partner,
  });

  it('drops the partner of the least-ranked hit before the hit itself', () => {
    const items = [
      recalled(0, 0, false),
      recalled(4, 1, false),
      recalled(5, 1, true),
    ];

    expect(withoutLeastRanked(items).map((item) => item.index)).toEqual([0, 4]);
  });

  it('drops the hit once its partner is gone', () => {
    const items = [recalled(0, 0, false), recalled(4, 1, false)];

    expect(withoutLeastRanked(items).map((item) => item.index)).toEqual([0]);
  });
});

describe('recallEmbeddingPool', () => {
  const turns = (count: number, chars: number) =>
    Array.from({ length: count }, (_, index) =>
      message(
        index + 1,
        index % 2 === 0 ? 'user' : 'assistant',
        'x'.repeat(chars)
      )
    );

  it('embeds nothing when the whole history fits the conversation budget', () => {
    expect(recallEmbeddingPool(turns(10, 100), 1000)).toEqual([]);
  });

  it('embeds only the messages older than the tail that is surely kept', () => {
    const history = turns(20, 100);
    const pool = recallEmbeddingPool(history, 1000);
    const surelyKept = Math.floor((1000 * RECALL_MIN_KEPT_SHARE) / 100);

    expect(pool).toEqual(history.slice(0, history.length - surelyKept));
  });
});

describe('retrievalStatsLines for memory', () => {
  it('keeps the memory counters out of the stats shown under an answer', () => {
    expect(
      retrievalStatsLines({
        memory: {
          turnsDropped: 12,
          messagesRecalled: 2,
          recallTokens: 40,
          recallMode: 'lexical',
          digestChars: 0,
        },
      })
    ).toEqual([]);
  });
});
