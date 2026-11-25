jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import type { WebContext, WebSearchProvider } from '../utils/web/types';
import { runWebSearch } from '../utils/web/runWebSearch';
import { capWebSources, isShortHistory } from '../utils/web/firstTurnSourceCap';
import { clearWebCaches } from '../utils/web/cache/webCache';
import {
  WEB_FIRST_TURN_SOURCE_CAP_MAX_HISTORY_TOKENS,
  WEB_FIRST_TURN_SOURCE_CAP_TOKENS,
  estimatePromptTokens,
} from '../constants/context-window';
import { DEFAULT_PROFILE } from '../constants/model-profiles';

const QUESTION = 'Who founded Zorblax Industries?';
const BLOCK_TOKENS = 700;
const blockOfTokens = (label: string, tokens: number): string =>
  `--- ${label} ---\n${'a'.repeat(tokens * 4)}`;

const webContext = (blocks: string[], uncited = 1): WebContext => ({
  context: blocks,
  sourceDocuments: [
    ...blocks.map((_, index) => ({
      kind: 'web' as const,
      name: `Source ${index + 1}`,
      url: `https://${index}.example/page`,
      read: true,
      passage: `passage ${index + 1}`,
      query: QUESTION,
      ordinal: index + 1,
    })),
    ...Array.from({ length: uncited }, (_, index) => ({
      kind: 'web' as const,
      name: `Unused ${index}`,
      url: `https://unused${index}.example/page`,
      read: false,
    })),
  ],
});

describe('capWebSources', () => {
  const blocks = ['one', 'two', 'three'].map((label) =>
    blockOfTokens(label, BLOCK_TOKENS)
  );

  it('keeps whole passages from the top until the next one would pass the cap', () => {
    const capped = capWebSources(webContext(blocks));

    expect(capped.context).toEqual(blocks.slice(0, 2));
    expect(capped.dropped).toBe(1);
    expect(
      capped.context.reduce((sum, b) => sum + estimatePromptTokens(b), 0)
    ).toBeLessThanOrEqual(WEB_FIRST_TURN_SOURCE_CAP_TOKENS);
  });

  it('never cuts a passage in half', () => {
    const capped = capWebSources(webContext(blocks));

    capped.context.forEach((block, index) => expect(block).toBe(blocks[index]));
  });

  it('turns the dropped passage into an unread source and leaves the rest alone', () => {
    const input = webContext(blocks);
    const { sourceDocuments } = capWebSources(input);

    expect(sourceDocuments[0]).toEqual(input.sourceDocuments[0]);
    expect(sourceDocuments[1]).toEqual(input.sourceDocuments[1]);
    expect(sourceDocuments[2]).toEqual({
      kind: 'web',
      name: 'Source 3',
      url: 'https://2.example/page',
      read: false,
      query: QUESTION,
    });
    expect(sourceDocuments[3]).toEqual(input.sourceDocuments[3]);
  });

  it('keeps the top passage even when it alone is over the cap', () => {
    const big = blockOfTokens('big', WEB_FIRST_TURN_SOURCE_CAP_TOKENS * 2);
    const capped = capWebSources(webContext([big, blocks[0]!]));

    expect(capped.context).toEqual([big]);
    expect(capped.dropped).toBe(1);
  });

  it('changes nothing when everything fits', () => {
    const input = webContext([blocks[0]!]);

    expect(capWebSources(input)).toEqual({ ...input, dropped: 0 });
  });
});

describe('isShortHistory', () => {
  it('accepts an empty chat and a short exchange', () => {
    expect(isShortHistory([])).toBe(true);
    expect(
      isShortHistory([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ])
    ).toBe(true);
  });

  it('rejects a history over the threshold', () => {
    const long = 'a'.repeat(WEB_FIRST_TURN_SOURCE_CAP_MAX_HISTORY_TOKENS * 8);

    expect(isShortHistory([{ role: 'user', content: long }])).toBe(false);
  });
});

describe('firstTurnSourceCap in runWebSearch', () => {
  const PAGE_TEXT = `Zorblax Industries was founded by Ada Quill in 1987. ${'Компания с богатой историей и большим числом сотрудников. '.repeat(40)}`;
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
  const search = (
    history: { role: string; content: string }[] = [],
    answersFromDocument = false
  ) =>
    runWebSearch({
      query: QUESTION,
      history,
      answersFromDocument,
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate: async () => '',
      profile: DEFAULT_PROFILE,
      contextCharBudget: 60_000,
    });
  const tokensOf = (context: string[]): number =>
    context.reduce((sum, block) => sum + estimatePromptTokens(block), 0);

  beforeEach(() => {
    clearWebCaches();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caps the web sources of a first turn at whole passages', async () => {
    const { context, sourceDocuments, telemetry } = await search();

    expect(tokensOf(context)).toBeLessThanOrEqual(
      WEB_FIRST_TURN_SOURCE_CAP_TOKENS
    );
    expect(telemetry.droppedByCap).toBeGreaterThan(0);
    expect(sourceDocuments.filter((source) => source.passage)).toHaveLength(
      context.length
    );
  });

  it('does not cap a turn that answers from an attached document', async () => {
    const { context, telemetry } = await search([], true);

    expect(tokensOf(context)).toBeGreaterThan(WEB_FIRST_TURN_SOURCE_CAP_TOKENS);
    expect(telemetry.droppedByCap).toBeUndefined();
  });

  it('does not cap once the conversation has grown', async () => {
    const history = [
      {
        role: 'user',
        content: 'a'.repeat(WEB_FIRST_TURN_SOURCE_CAP_MAX_HISTORY_TOKENS * 8),
      },
    ];
    const { context, telemetry } = await search(history);

    expect(tokensOf(context)).toBeGreaterThan(WEB_FIRST_TURN_SOURCE_CAP_TOKENS);
    expect(telemetry.droppedByCap).toBeUndefined();
  });
});
