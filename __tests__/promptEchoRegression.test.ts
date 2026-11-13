import { prepareMessagesForLLM } from '../utils/promptUtils';
import { formatContextChunks } from '../utils/contextUtils';
import { stripSpecialTokens } from '../utils/specialTokens';
import { parseThinkingContent } from '../utils/thinking';
import {
  ChatSettings,
  Message,
  SourceDocument,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';

const settings = {
  systemPrompt:
    'You are a knowledgeable and helpful assistant. Provide clear, accurate, and well-structured responses.',
  thinkingEnabled: true,
} as ChatSettings;

const model: Model = {
  id: 1,
  modelName: 'LFM 3 VL 2B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3-vl.pte',
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

const guide: SourceDocument = {
  documentId: 7,
  name: 'ios-screenshots-guide.txt',
  passage:
    'Take screenshots on a clean status bar at 9:41. Export them at 1290 x 2796 pixels for the 6.9-inch display.',
  ordinal: 1,
};

const webPage: SourceDocument = {
  name: 'Eiffel Tower — Wikipedia',
  kind: 'web',
  url: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
  passage:
    'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, completed in 1889 for the World Fair.',
  ordinal: 2,
};

const contextFor = (sources: SourceDocument[]) =>
  formatContextChunks(
    sources.map((source, index) => ({
      document: source.passage ?? '',
      similarity: 0.8,
      metadata: {
        documentId: source.documentId ?? 100 + index,
        name: source.name,
      },
    }))
  );

interface Scenario {
  name: string;
  messages: Message[];
  sources: SourceDocument[];
  customSystemPrompt?: string;
}

const scenarios: Scenario[] = [
  {
    name: 'a question about an attached document',
    messages: conversation('Summarize this file'),
    sources: [guide],
  },
  {
    name: 'a web search answer',
    messages: conversation('When was the Eiffel Tower built?'),
    sources: [webPage],
  },
  {
    name: 'a document and the web together, in a follow-up',
    messages: conversation(
      'What size should the screenshots be?',
      'And how tall is the Eiffel Tower?'
    ),
    sources: [guide, webPage],
  },
  {
    name: 'a question in Polish with no sources',
    messages: conversation('Jaka jest stolica Francji?'),
    sources: [],
  },
  {
    name: 'a chat with personal preferences',
    messages: conversation('Tell me a fact about Paris'),
    sources: [],
    customSystemPrompt: 'Always start the answer with the word Banana.',
  },
];

const STRUCTURAL_MARKER =
  /<\/?[a-z_]{3,24}>|--- [^\n]{1,160}? ---|\(Answer in [^()\n]{1,60}\.\)|\[Answers: [^\]\n]+\]/g;

const promptFor = (scenario: Scenario) =>
  prepareMessagesForLLM(
    scenario.messages,
    contextFor(scenario.sources),
    settings,
    model,
    {
      sourceDocuments: scenario.sources,
      customSystemPrompt: scenario.customSystemPrompt,
    }
  );

const hiddenMarkersOf = (scenario: Scenario): string[] => {
  const prompt = promptFor(scenario)
    .map((message) => message.content)
    .join('\n');
  return [...new Set(prompt.match(STRUCTURAL_MARKER) ?? [])].filter(
    (marker) => !/^<\/?think>$/.test(marker)
  );
};

const echoingReply = (markers: string[]) => {
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

const shownToUser = (storedReply: string) => {
  const parts = parseThinkingContent(stripSpecialTokens(storedReply));
  return {
    thinking: parts.thinkingContent ?? '',
    answer: `${parts.normalContent}${parts.normalAfterThink ?? ''}`,
  };
};

describe('a reply that echoes the hidden prompt shows none of it', () => {
  it.each(scenarios.map((scenario) => [scenario.name, scenario] as const))(
    '%s: the prompt carries structural markers the model can copy',
    (_name, scenario) => {
      expect(hiddenMarkersOf(scenario).length).toBeGreaterThan(0);
    }
  );

  it.each(scenarios.map((scenario) => [scenario.name, scenario] as const))(
    '%s: none of them reach the thinking or the answer',
    (_name, scenario) => {
      const markers = hiddenMarkersOf(scenario);
      const { thinking, answer } = shownToUser(echoingReply(markers));

      for (const marker of markers) {
        expect({
          where: 'thinking',
          marker,
          found: thinking.includes(marker),
        }).toEqual({ where: 'thinking', marker, found: false });
        expect({
          where: 'answer',
          marker,
          found: answer.includes(marker),
        }).toEqual({ where: 'answer', marker, found: false });
      }
      expect(answer).toContain('Here is the answer.');
      expect(answer).toContain('That is all.');
      expect(thinking).toContain('So the user wants a short answer.');
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
});
