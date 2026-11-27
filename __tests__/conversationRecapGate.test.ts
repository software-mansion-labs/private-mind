jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import type {
  ExtractedArticle,
  WebSearchProvider,
  WebSearchResult,
} from '../utils/web/types';
import { runWebSearch } from '../utils/web/runWebSearch';
import { isAboutTheConversation } from '../utils/web/buildSearchQuery';
import { NO_SEARCH_LEXICONS } from '../utils/web/noSearchLexicon';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { DEFAULT_PROFILE } from '../constants/model-profiles';

const LLM_PROFILE = { ...DEFAULT_PROFILE, webPlanner: 'llm' as const };

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
        title: 'Match report',
        url: 'https://a.example/report',
        snippet: 'Match report',
      },
    ];
  }
}

const fetchPage = async (url: string): Promise<ExtractedArticle> => ({
  url,
  title: url,
  text: `Match report. ${'the final score and the goals. '.repeat(8)}`,
  siteName: url,
});

const plannerThatAlwaysSearches = async () =>
  JSON.stringify({
    needs_search: true,
    intent: 'summary of an outside event',
    kind: 'general',
    queries: ['match report'],
    expects: [],
  });

const search = (question: string) => {
  const provider = new MockProvider();
  const generate = jest.fn(plannerThatAlwaysSearches);
  return {
    provider,
    generate,
    done: runWebSearch({
      query: question,
      history: [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate,
      fetchArticle: fetchPage,
      today: '2026-11-26',
      profile: LLM_PROFILE,
    }),
  };
};

const RECAPS_OF_THE_CONVERSATION = [
  { language: 'en', question: 'Summarize our conversation' },
  { language: 'en', question: 'Can you summarize?' },
  { language: 'en', question: 'Give me a summary of what we discussed' },
  { language: 'pl', question: 'Podsumuj naszą rozmowę' },
  { language: 'pl', question: 'podsumuj' },
  { language: 'de', question: 'Fasse unser Gespräch zusammen' },
  { language: 'de', question: 'Fasse bitte alles zusammen' },
  { language: 'es', question: 'Resume nuestra conversación' },
  { language: 'es', question: 'Hazme un resumen de lo que hemos hablado' },
  { language: 'hi', question: 'हमारी बातचीत का सारांश दो' },
  { language: 'ru', question: 'Подведи итог нашего разговора' },
  { language: 'ru', question: 'Кратко перескажи, о чём мы говорили' },
];

const SUMMARIES_OF_SOMETHING_OUTSIDE = [
  { language: 'en', question: "Write a summary of yesterday's match" },
  { language: 'en', question: 'Summarize https://example.com/article' },
  { language: 'en', question: 'Summarize the latest news about Poland' },
  { language: 'pl', question: 'podsumuj wczorajszy mecz' },
  { language: 'pl', question: 'Streść dzisiejsze wiadomości' },
  { language: 'de', question: 'Fasse das gestrige Spiel zusammen' },
  { language: 'es', question: 'Resume el partido de ayer' },
  { language: 'hi', question: 'आज की खबरों का सारांश दो' },
  { language: 'ru', question: 'Подведи итоги вчерашнего матча' },
];

const ONE_RECAP_PER_LEXICON_LANGUAGE = [
  { language: 'en', recap: 'Recap what we talked about so far' },
  { language: 'pl', recap: 'Streść, o czym rozmawialiśmy' },
  {
    language: 'de',
    recap: 'Kannst du zusammenfassen, worüber wir gesprochen haben?',
  },
  { language: 'nl', recap: 'Vat ons gesprek samen' },
  { language: 'fr', recap: 'Résume notre conversation' },
  { language: 'es', recap: 'Resume esta conversación, por favor' },
  { language: 'pt', recap: 'Resuma a nossa conversa' },
  { language: 'it', recap: 'Riassumi la nostra conversazione' },
  { language: 'ro', recap: 'Rezumă conversația noastră' },
  { language: 'cs', recap: 'Shrň naši konverzaci' },
  { language: 'ru', recap: 'Резюмируй наш разговор' },
  { language: 'uk', recap: 'Підсумуй нашу розмову' },
  { language: 'el', recap: 'Συνόψισε τη συζήτησή μας' },
  { language: 'ar', recap: 'لخص محادثتنا' },
  { language: 'he', recap: 'סכם את השיחה שלנו' },
  { language: 'hi', recap: 'अब तक की बातचीत का सारांश बताओ' },
  { language: 'ur', recap: 'ہماری گفتگو کا خلاصہ کریں' },
  { language: 'bn', recap: 'আমাদের কথোপকথনের সারাংশ দাও' },
  { language: 'fa', recap: 'گفتگوی ما را خلاصه کن' },
  { language: 'tr', recap: 'Konuşmamızı özetle' },
  { language: 'id', recap: 'Ringkas percakapan kita' },
  { language: 'ko', recap: '우리 대화를 요약해줘' },
];

const ONE_BARE_SUMMARY_VERB_PER_LEXICON_LANGUAGE = [
  { language: 'en', bare: 'Please summarise it' },
  { language: 'pl', bare: 'Podsumuj to krótko' },
  { language: 'de', bare: 'Zusammenfassung bitte' },
  { language: 'nl', bare: 'Vat het samen' },
  { language: 'fr', bare: 'Résume-moi tout ça' },
  { language: 'es', bare: 'Resúmelo' },
  { language: 'pt', bare: 'Resuma tudo' },
  { language: 'it', bare: 'Riassumi tutto' },
  { language: 'ro', bare: 'Rezumă totul' },
  { language: 'cs', bare: 'Shrň to' },
  { language: 'ru', bare: 'Подведи итоги' },
  { language: 'uk', bare: 'Підсумуй' },
  { language: 'el', bare: 'Κάνε μια περίληψη' },
  { language: 'ar', bare: 'لخص' },
  { language: 'he', bare: 'תסכם' },
  { language: 'hi', bare: 'सारांश दो' },
  { language: 'ur', bare: 'خلاصہ کریں' },
  { language: 'bn', bare: 'সারাংশ দাও' },
  { language: 'fa', bare: 'خلاصه کن' },
  { language: 'tr', bare: 'Özetle' },
  { language: 'id', bare: 'Tolong rangkum' },
  { language: 'ko', bare: '요약해줘' },
];

const OUTSIDE_SUMMARY_PER_LANGUAGE = [
  { language: 'nl', outside: 'Vat de wedstrijd van gisteren samen' },
  { language: 'fr', outside: 'Résume le match d’hier' },
  { language: 'pt', outside: 'Resuma o jogo de ontem' },
  { language: 'it', outside: 'Riassumi la partita di ieri' },
  { language: 'cs', outside: 'Shrň včerejší zápas' },
  { language: 'uk', outside: 'Підсумуй вчорашній матч' },
  { language: 'tr', outside: 'Dünkü maçı özetle' },
  { language: 'id', outside: 'Ringkas pertandingan kemarin' },
  { language: 'ar', outside: 'لخص مباراة الأمس' },
  { language: 'ko', outside: '어제 경기를 요약해줘' },
];

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('a request to summarise the conversation itself', () => {
  it.each(RECAPS_OF_THE_CONVERSATION)(
    'is gated without asking the planner or the search engine ($language): $question',
    async ({ question }) => {
      const run = search(question);
      const { telemetry } = await run.done;

      expect(run.generate).not.toHaveBeenCalled();
      expect(run.provider.calls).toEqual([]);
      expect(telemetry.skippedReason).toBe('gated');
    }
  );
});

describe('a request to summarise something outside the conversation', () => {
  it.each(SUMMARIES_OF_SOMETHING_OUTSIDE)(
    'is planned and searched ($language): $question',
    async ({ question }) => {
      const run = search(question);
      const { telemetry } = await run.done;

      expect(telemetry.skippedReason).toBeUndefined();
      expect(telemetry.plannedQueries.length).toBeGreaterThan(0);
      expect(run.provider.calls.length).toBeGreaterThan(0);
    }
  );
});

describe('isAboutTheConversation in every lexicon language', () => {
  it('has a recap example for every lexicon language', () => {
    expect(
      ONE_RECAP_PER_LEXICON_LANGUAGE.map(({ language }) => language).sort()
    ).toEqual(Object.keys(NO_SEARCH_LEXICONS).sort());
    expect(
      ONE_BARE_SUMMARY_VERB_PER_LEXICON_LANGUAGE.map(
        ({ language }) => language
      ).sort()
    ).toEqual(Object.keys(NO_SEARCH_LEXICONS).sort());
  });

  it.each(ONE_RECAP_PER_LEXICON_LANGUAGE)(
    'reads a summary aimed at the conversation as a recap ($language): $recap',
    ({ recap }) => {
      expect(isAboutTheConversation(recap)).toBe(true);
    }
  );

  it.each(ONE_BARE_SUMMARY_VERB_PER_LEXICON_LANGUAGE)(
    'reads a summary verb with no object as a recap ($language): $bare',
    ({ bare }) => {
      expect(isAboutTheConversation(bare)).toBe(true);
    }
  );

  it.each(OUTSIDE_SUMMARY_PER_LANGUAGE)(
    'leaves a summary of a named outside thing alone ($language): $outside',
    ({ outside }) => {
      expect(isAboutTheConversation(outside)).toBe(false);
    }
  );

  it('leaves a summary of a pasted-in or named document alone', () => {
    for (const question of [
      'Summarize the conversation between Biden and Xi',
      'Summarize the season so far',
      'Podsumuj rozmowę prezydenta z premierem',
      'Summarize https://example.com/article',
    ]) {
      expect(isAboutTheConversation(question)).toBe(false);
    }
  });

  it('keeps a question about what was said on the gate even without a summary verb', () => {
    for (const question of [
      'What have we learned so far?',
      'Co ustaliliśmy?',
      'O czym rozmawialiśmy?',
      'Was haben wir besprochen?',
    ]) {
      expect(isAboutTheConversation(question)).toBe(true);
    }
  });

  it('lets an explicit search verb take a question about what was said to the planner', () => {
    expect(isAboutTheConversation('Search the web for what we discussed')).toBe(
      false
    );
  });
});
