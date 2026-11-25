jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import type {
  ExtractedArticle,
  WebSearchProvider,
  WebSearchResult,
} from '../utils/web/types';
import { runWebSearch } from '../utils/web/runWebSearch';
import { fastPlanWebSearch, inferIntentKind } from '../utils/web/fastPlan';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { DEFAULT_PROFILE } from '../constants/model-profiles';
import { WEB_QUERY_MAX_CHARS } from '../constants/web';

const QUESTION = 'Who founded Zorblax Industries in 1987?';
const LLM_PROFILE = { ...DEFAULT_PROFILE, webPlanner: 'llm' as const };
const PAGE_BODY = `Zorblax Industries was founded in 1987 by Ada Quill. ${'general company profile. '.repeat(8)}`;

class MockProvider implements WebSearchProvider {
  readonly id = 'mock';
  calls: string[] = [];
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls.push(query);
    return [
      {
        title: 'Zorblax Industries',
        url: 'https://a.example/zorblax',
        snippet: 'Zorblax Industries founded 1987',
      },
    ];
  }
}

const fetchPage = async (url: string): Promise<ExtractedArticle> => ({
  url,
  title: url,
  text: PAGE_BODY,
  siteName: url,
});

const plannerJson = async () =>
  JSON.stringify({
    needs_search: true,
    intent: 'company founder',
    kind: 'person',
    queries: ['Zorblax Industries founder'],
    expects: ['founder name'],
  });

const search = (
  question: string,
  options: {
    history?: { role: string; content: string }[];
    generate?: jest.Mock;
    provider?: MockProvider;
  } = {}
) => {
  const provider = options.provider ?? new MockProvider();
  const generate = options.generate ?? jest.fn(plannerJson);
  return {
    provider,
    generate,
    done: runWebSearch({
      query: question,
      history: options.history ?? [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate,
      fetchArticle: fetchPage,
      today: '2026-07-20',
      profile: LLM_PROFILE,
    }),
  };
};

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('the fast web plan in runWebSearch', () => {
  it('searches a standalone question without asking the model for a plan', async () => {
    const run = search(QUESTION);
    const { telemetry, context } = await run.done;

    expect(run.generate).not.toHaveBeenCalled();
    expect(run.provider.calls).toEqual([QUESTION]);
    expect(telemetry.timings?.planner).toBe('fast');
    expect(telemetry.needsSearch).toBe(true);
    expect(context.length).toBeGreaterThan(0);
  });

  it('still plans with the model for a follow-up that depends on the conversation', async () => {
    const run = search('How old is he now?', {
      history: [
        { role: 'user', content: 'Who founded Zorblax Industries?' },
        { role: 'assistant', content: 'Ada Quill founded Zorblax Industries.' },
      ],
    });
    const { telemetry } = await run.done;

    expect(run.generate).toHaveBeenCalledTimes(1);
    expect(telemetry.timings?.planner).toBe('llm');
  });

  it('does not touch a profile that already skips the planner', async () => {
    const provider = new MockProvider();
    const generate = jest.fn(plannerJson);
    const { telemetry } = await runWebSearch({
      query: QUESTION,
      history: [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate,
      fetchArticle: fetchPage,
      profile: DEFAULT_PROFILE,
    });

    expect(generate).not.toHaveBeenCalled();
    expect(telemetry.timings?.planner).toBeUndefined();
  });

  it('leaves a request with nothing to look up to the planner, which decides not to search', async () => {
    const generate = jest.fn(async () =>
      JSON.stringify({
        needs_search: false,
        intent: 'translate a phrase',
        kind: 'chat',
        queries: [],
        expects: [],
      })
    );
    const run = search("Translate 'thank you' into Hindi", { generate });
    const { telemetry } = await run.done;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(telemetry.timings?.planner).toBe('llm');
    expect(run.provider.calls).toEqual([]);
  });

  it('keeps the recap gate: a question about the conversation is not searched', async () => {
    const run = search('Summarize what we discussed');
    const { telemetry } = await run.done;

    expect(run.provider.calls).toEqual([]);
    expect(telemetry.skippedReason).toBe('gated');
  });
});

describe('fastPlanWebSearch', () => {
  it('builds the keyword query, with no model-made fields', () => {
    expect(fastPlanWebSearch(QUESTION, [])).toEqual({
      needsSearch: true,
      intent: '',
      queries: [QUESTION],
    });
  });

  it('strips a request opener the same way the verbatim planner does', () => {
    expect(
      fastPlanWebSearch('Please find who founded Zorblax Industries', [])
        ?.queries
    ).toEqual(['who founded Zorblax Industries']);
  });

  it('carries a domain as a site restriction on the plan and the query', () => {
    const plan = fastPlanWebSearch(
      'What does the Zorblax Pro cost on zorblax.com?',
      []
    );

    expect(plan?.siteRestriction).toBe('zorblax.com');
    expect(plan?.queries[0]).toMatch(/site:zorblax\.com$/);
  });

  it('infers a kind for the questions whose ranking it changes', () => {
    expect(
      fastPlanWebSearch('What is the price of the Zorblax Pro?', [])?.kind
    ).toBe('price');
    expect(
      inferIntentKind('In what year was Zorblax Industries founded?')
    ).toBe('date');
    expect(inferIntentKind('How to reset a Zorblax Pro')).toBe('howto');
    expect(inferIntentKind(QUESTION)).toBeUndefined();
  });

  it('defers a pronoun-only question to the planner', () => {
    expect(fastPlanWebSearch('How old is he now?', [])).toBeNull();
  });

  it('defers an anaphoric follow-up even when there is history', () => {
    const history = [
      { role: 'user', content: 'Tell me about Zorblax Industries' },
      { role: 'assistant', content: 'It is a company.' },
    ];

    expect(
      fastPlanWebSearch('And how many employees does it have?', history)
    ).toBeNull();
  });

  it('defers a bare question in a chat that has history, where the detectors cannot tell', () => {
    const history = [
      { role: 'user', content: 'Tell me about Zorblax Industries' },
      { role: 'assistant', content: 'It is a company.' },
    ];

    expect(
      fastPlanWebSearch('And how many people work there?', history)
    ).toBeNull();
  });

  it('defers a question that is still over the length cap after reduction', () => {
    const long = `Who founded ${'Zorblax Industries and its many subsidiaries '.repeat(6)}?`;

    expect(long.length).toBeGreaterThan(WEB_QUERY_MAX_CHARS);
    expect(fastPlanWebSearch(long, [])).toBeNull();
  });

  it('defers a language whose keyword reduction has no stopword coverage', () => {
    expect(
      fastPlanWebSearch('ゾルブラックス社を設立したのは誰ですか', [])
    ).toBeNull();
  });

  it('defers a language whose writing and opinion requests it cannot recognise', () => {
    for (const request of [
      'Scrivi una poesia sulla città di Roma',
      'İstanbul hakkında kısa bir şiir yaz',
      'Tuliskan puisi pendek tentang kota Jakarta',
      'Что ты думаешь о новом iPhone 17 Pro?',
    ]) {
      expect(fastPlanWebSearch(request, [])).toBeNull();
    }
    expect(
      fastPlanWebSearch('Kto wygrał finał Ligi Mistrzów w 2025 roku?', [])
    ).not.toBeNull();
  });

  it('defers when too few terms are left to search on', () => {
    expect(fastPlanWebSearch('Zorblax?', [])).toBeNull();
    expect(fastPlanWebSearch('   ', [])).toBeNull();
  });

  it('defers a recap request to the existing cheap gate', () => {
    expect(fastPlanWebSearch('Summarize what we discussed', [])).toBeNull();
  });

  it.each([
    { language: 'en', question: "Translate 'thank you' into Hindi" },
    {
      language: 'en',
      question: 'Rewrite this sentence to sound more formal: we are late',
    },
    {
      language: 'en',
      question: 'Could you write a short poem about the autumn rain?',
    },
    {
      language: 'en',
      question: 'Write a Python function `sort_by_date(items)` for my list',
    },
    { language: 'en', question: 'How much is 1499 * 12 for a yearly plan?' },
    { language: 'en', question: 'What do you think about working remotely?' },
    { language: 'en', question: 'Should I learn the guitar or the piano?' },
    { language: 'pl', question: 'Przetłumacz "dziękuję" na angielski' },
    { language: 'pl', question: 'Napisz wiersz o jesieni' },
    {
      language: 'pl',
      question: 'Proszę, popraw błędy w tym zdaniu: ja idę do sklep',
    },
    { language: 'de', question: 'Übersetze "danke" ins Englische' },
    { language: 'es', question: 'Traduce "gracias" al alemán, por favor' },
    { language: 'fr', question: 'Traduis "merci" en polonais' },
    { language: 'hi', question: "'धन्यवाद' का अंग्रेज़ी में अनुवाद करो" },
  ])(
    'defers a request with no search signal to the planner ($language): $question',
    ({ question }) => {
      expect(fastPlanWebSearch(question, [])).toBeNull();
    }
  );

  describe('a follow-up whose only new detail is a number', () => {
    const history = [
      { role: 'user', content: 'Tell me about the Gdańsk Shipyard' },
      {
        role: 'assistant',
        content: 'The Gdańsk Shipyard was founded in 1945 in Gdańsk.',
      },
    ];

    it.each([
      { language: 'en', question: 'And the population in 2020?' },
      { language: 'en', question: 'How many people worked there in 1980?' },
      { language: 'pl', question: 'A ile kosztowało to w 2023?' },
      { language: 'de', question: 'Wie viele Einwohner hatte es 2020?' },
      { language: 'hi', question: '2020 में इसकी आबादी कितनी थी?' },
    ])(
      'leaves the subject to the planner ($language): $question',
      ({ question }) => {
        expect(fastPlanWebSearch(question, history)).toBeNull();
      }
    );

    it('still plans a follow-up that names its own subject next to the year', () => {
      expect(
        fastPlanWebSearch(
          'What was the Gdańsk Shipyard revenue in 2020?',
          history
        )?.queries
      ).toEqual(['What was the Gdańsk Shipyard revenue in 2020?']);
    });
  });

  it('plans a standalone question even in a long chat', () => {
    const history = [
      { role: 'user', content: 'Tell me about Zorblax Industries' },
      { role: 'assistant', content: 'It is a company.' },
    ];

    expect(
      fastPlanWebSearch('Who won the 1998 World Cup in France?', history)
        ?.queries
    ).toEqual(['Who won the 1998 World Cup in France?']);
  });
});
