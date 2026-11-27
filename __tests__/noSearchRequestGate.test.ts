jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest.fn(),
}));

import type {
  ExtractedArticle,
  WebSearchProvider,
  WebSearchResult,
} from '../utils/web/types';
import { runWebSearch } from '../utils/web/runWebSearch';
import { isNoSearchRequest } from '../utils/web/fastPlan';
import { lacksSearchSignal } from '../utils/web/noSearchSignal';
import { NO_SEARCH_LEXICONS } from '../utils/web/noSearchLexicon';
import { clearWebCaches } from '../utils/web/cache/webCache';
import {
  DEFAULT_PROFILE,
  type ModelProfile,
} from '../constants/model-profiles';

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
        title: 'Poesie sulla pioggia - Frasi Mania',
        url: 'https://a.example/poesie',
        snippet: 'Poesie sulla pioggia',
      },
    ];
  }
}

const fetchPage = async (url: string): Promise<ExtractedArticle> => ({
  url,
  title: url,
  text: `Poesie sulla pioggia. ${'una raccolta di frasi. '.repeat(8)}`,
  siteName: url,
});

const plannerThatAlwaysSearches = async () =>
  JSON.stringify({
    needs_search: true,
    intent: 'find matching pages',
    kind: 'general',
    queries: ['poesie sulla pioggia'],
    expects: [],
  });

const search = (question: string, profile: ModelProfile = LLM_PROFILE) => {
  const provider = new MockProvider();
  const generate = jest.fn(plannerThatAlwaysSearches);
  const progress: string[] = [];
  return {
    provider,
    generate,
    progress,
    done: runWebSearch({
      query: question,
      history: [],
      provider,
      embeddings: null,
      embeddingModelReady: false,
      generate,
      fetchArticle: fetchPage,
      today: '2026-11-26',
      profile,
      onProgress: (event) => progress.push(event.type),
    }),
  };
};

const REQUESTS_THAT_NEED_NO_SEARCH = [
  { language: 'en', question: 'Write a short poem about the rain' },
  { language: 'en', question: 'Tell me a joke about cats' },
  { language: 'en', question: "Translate 'good morning' into Spanish" },
  { language: 'en', question: 'What do you think about working remotely?' },
  { language: 'en', question: 'Could you write a story about a lost dragon?' },
  { language: 'it', question: 'Scrivi una breve poesia sulla pioggia' },
  { language: 'it', question: 'Raccontami una barzelletta sui gatti' },
  { language: 'it', question: 'Traduci "grazie mille" in inglese' },
  { language: 'it', question: 'Cosa ne pensi del lavoro da remoto?' },
  { language: 'pl', question: 'Napisz wiersz o jesieni' },
  { language: 'pl', question: 'Opowiedz mi bajkę o smoku' },
  { language: 'pl', question: 'Przetłumacz "dziękuję" na angielski' },
  { language: 'pl', question: 'Czy powinienem kupić nowy laptop?' },
  { language: 'de', question: 'Erzähl mir einen Witz über Katzen' },
  {
    language: 'de',
    question: 'Kannst du mir ein Gedicht über den Herbst schreiben?',
  },
  { language: 'de', question: 'Was hältst du von Homeoffice?' },
  { language: 'hi', question: 'क्या आप बारिश पर एक कविता लिख सकते हैं?' },
  { language: 'hi', question: 'मुझे एक चुटकुला सुनाओ' },
  { language: 'hi', question: 'इस वाक्य को अंग्रेज़ी में अनुवाद कर दो' },
  {
    language: 'hi',
    question: 'घर से काम करने के बारे में आप क्या सोचते हैं?',
  },
  { language: 'es', question: '¿Puedes escribir un poema sobre el mar?' },
  { language: 'es', question: 'Cuéntame un chiste de gatos' },
  { language: 'es', question: '¿Qué opinas del teletrabajo?' },
  { language: 'tr', question: 'İstanbul hakkında kısa bir şiir yaz' },
  { language: 'tr', question: 'Bana bir fıkra anlat' },
  { language: 'tr', question: 'Evden çalışma hakkında ne düşünüyorsun?' },
  { language: 'ru', question: "Переведи 'спасибо' на английский" },
  { language: 'ru', question: 'Напиши мне стихотворение про осенний дождь' },
  { language: 'ru', question: 'Расскажи мне анекдот про кошек' },
  { language: 'ru', question: 'Что ты думаешь о работе из дома?' },
  { language: 'id', question: 'Tuliskan puisi pendek tentang kota Jakarta' },
  { language: 'id', question: 'Ceritakan sebuah dongeng tentang kancil' },
  { language: 'id', question: 'Apa pendapatmu tentang kerja dari rumah?' },
  { language: 'ur', question: 'کیا آپ میرے لیے ایک غزل لکھ سکتے ہیں؟' },
  { language: 'ur', question: 'مجھے ایک لطیفہ سناؤ' },
  { language: 'ur', question: "'شکریہ' کا انگریزی میں ترجمہ کریں" },
  { language: 'ar', question: 'اكتب قصيدة عن البحر' },
  { language: 'ar', question: 'هل يمكنك كتابة قصيدة عن البحر؟' },
  { language: 'ar', question: 'ما رأيك في العمل عن بعد؟' },
];

const REQUESTS_WITH_A_FRESHNESS_OR_LOOKUP_SIGNAL = [
  { language: 'en', question: "Write a short report on yesterday's match" },
  { language: 'en', question: 'Translate the latest news about Poland' },
  { language: 'en', question: 'Tell me a joke about the 2024 election' },
  {
    language: 'en',
    question: 'Write a poem about Kraków, look it up online first',
  },
  {
    language: 'en',
    question: 'Translate https://example.com/zorblax-report into Polish',
  },
  { language: 'pl', question: 'Napisz podsumowanie dzisiejszych wiadomości' },
  { language: 'it', question: 'Scrivi un riassunto delle notizie di oggi' },
  {
    language: 'de',
    question: 'Schreib eine Zusammenfassung der heutigen Nachrichten',
  },
  { language: 'es', question: 'Escribe un resumen de las noticias de hoy' },
  { language: 'hi', question: 'आज की खबरों का सारांश लिखो' },
  { language: 'tr', question: 'Bugünkü haberlerin özetini yaz' },
  {
    language: 'ru',
    question: 'Напиши краткое содержание сегодняшних новостей',
  },
  { language: 'ar', question: 'اكتب ملخصا لأخبار اليوم' },
  { language: 'id', question: 'Tuliskan ringkasan berita hari ini' },
];

const FRESH_REQUESTS_BY_LANGUAGE = [
  { language: 'en', fresh: "Write a poem about today's news" },
  { language: 'pl', fresh: 'Napisz podsumowanie dzisiejszych wiadomości' },
  { language: 'de', fresh: 'Schreib einen Text über die heutigen Nachrichten' },
  { language: 'nl', fresh: 'Schrijf een gedicht over het nieuws van vandaag' },
  { language: 'fr', fresh: "Écris un poème sur l'actualité d'aujourd'hui" },
  { language: 'es', fresh: 'Escribe un poema sobre las noticias de hoy' },
  { language: 'pt', fresh: 'Escreva um poema sobre as notícias de hoje' },
  { language: 'it', fresh: 'Scrivi una poesia sulle notizie di oggi' },
  { language: 'ro', fresh: 'Scrie o poezie despre știrile de azi' },
  { language: 'cs', fresh: 'Napiš báseň o dnešních zprávách' },
  { language: 'ru', fresh: 'Напиши стихотворение о сегодняшних новостях' },
  { language: 'uk', fresh: 'Напиши вірш про сьогоднішні новини' },
  { language: 'el', fresh: 'Γράψε ένα ποίημα για τις σημερινές ειδήσεις' },
  { language: 'ar', fresh: 'اكتب قصيدة عن أخبار اليوم' },
  { language: 'he', fresh: 'כתוב שיר על החדשות של היום' },
  { language: 'hi', fresh: 'आज की खबरों पर एक कविता लिखो' },
  { language: 'ur', fresh: 'آج کی خبروں پر ایک نظم لکھو' },
  { language: 'bn', fresh: 'আজকের খবর নিয়ে একটি কবিতা লেখো' },
  { language: 'fa', fresh: 'یک شعر درباره اخبار امروز بنویس' },
  { language: 'tr', fresh: 'Bugünkü haberler hakkında bir şiir yaz' },
  { language: 'id', fresh: 'Tuliskan puisi tentang berita hari ini' },
  { language: 'ko', fresh: '오늘 뉴스에 대한 시를 써줘' },
];

const LOOKUP_REQUESTS_BY_LANGUAGE = [
  { language: 'en', lookup: 'Write a poem about Kraków using Wikipedia' },
  { language: 'pl', lookup: 'Napisz wiersz o Krakowie, poszukaj w internecie' },
  { language: 'de', lookup: 'Schreib ein Gedicht über Berlin laut Wikipedia' },
  { language: 'es', lookup: 'Escribe un poema sobre Madrid según Wikipedia' },
  { language: 'ru', lookup: 'Напиши стихотворение о Москве, поищи в сети' },
  { language: 'tr', lookup: 'İnternette arat, Ankara hakkında bir şiir yaz' },
  { language: 'hi', lookup: 'इंटरनेट से खोजकर दिल्ली पर एक कविता लिखो' },
  { language: 'ar', lookup: 'اكتب قصيدة عن القاهرة وفقا لويكيبيديا' },
];

beforeEach(() => {
  clearWebCaches();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('a request the lexicon recognises as needing no search, with web search on', () => {
  it.each(REQUESTS_THAT_NEED_NO_SEARCH)(
    'answers without asking the planner or the search engine ($language): $question',
    async ({ question }) => {
      const run = search(question);
      const { context, sourceDocuments, telemetry } = await run.done;

      expect(run.generate).not.toHaveBeenCalled();
      expect(run.provider.calls).toEqual([]);
      expect(context).toEqual([]);
      expect(sourceDocuments).toEqual([]);
      expect(telemetry.needsSearch).toBe(false);
      expect(telemetry.skippedReason).toBe('no-search-request');
    }
  );

  it('reports the turn as answered without searching, never as searched', async () => {
    const run = search('Scrivi una breve poesia sulla pioggia');
    await run.done;

    expect(run.progress).toEqual(['skipped']);
  });

  it('skips the verbatim profile too, which would otherwise search the request word for word', async () => {
    const run = search(
      'Scrivi una breve poesia sulla pioggia',
      DEFAULT_PROFILE
    );
    const { telemetry } = await run.done;

    expect(run.provider.calls).toEqual([]);
    expect(telemetry.skippedReason).toBe('no-search-request');
  });

  it('keeps a recap of the conversation on the existing gate', async () => {
    const run = search('Summarize what we discussed');
    const { telemetry } = await run.done;

    expect(run.provider.calls).toEqual([]);
    expect(telemetry.skippedReason).toBe('gated');
  });
});

describe('a recognised request that also asks for something fresh or looked up', () => {
  it.each(REQUESTS_WITH_A_FRESHNESS_OR_LOOKUP_SIGNAL)(
    'is still planned and searched ($language): $question',
    async ({ question, language }) => {
      expect(lacksSearchSignal(question, language)).toBe(true);
      const run = search(question);
      const { telemetry } = await run.done;

      expect(run.generate).toHaveBeenCalled();
      expect(run.provider.calls.length).toBeGreaterThan(0);
      expect(telemetry.skippedReason).toBeUndefined();
    }
  );
});

describe('isNoSearchRequest', () => {
  it('lists freshness words and lookup verbs for every lexicon language', () => {
    for (const lexicon of Object.values(NO_SEARCH_LEXICONS)) {
      expect(lexicon.freshnessWords.length).toBeGreaterThan(0);
      expect(lexicon.lookupVerbs.length).toBeGreaterThan(0);
    }
    expect(
      FRESH_REQUESTS_BY_LANGUAGE.map(({ language }) => language).sort()
    ).toEqual(Object.keys(NO_SEARCH_LEXICONS).sort());
  });

  it.each(FRESH_REQUESTS_BY_LANGUAGE)(
    'hands a recognised request about something current back to the planner ($language): $fresh',
    ({ language, fresh }) => {
      expect(lacksSearchSignal(fresh, language)).toBe(true);
      expect(isNoSearchRequest(fresh)).toBe(false);
    }
  );

  it.each(LOOKUP_REQUESTS_BY_LANGUAGE)(
    'hands a recognised request that names a lookup back to the planner ($language): $lookup',
    ({ language, lookup }) => {
      expect(lacksSearchSignal(lookup, language)).toBe(true);
      expect(isNoSearchRequest(lookup)).toBe(false);
    }
  );

  it('matches a starred freshness word by its beginning, so inflected forms count', () => {
    expect(isNoSearchRequest('Napisz wiersz o dzisiejszym meczu')).toBe(false);
    expect(isNoSearchRequest('Napisz wiersz o wczorajszym meczu')).toBe(false);
  });

  it('matches an unstarred freshness word only whole, so a longer word that starts with it does not count', () => {
    expect(isNoSearchRequest('आज़ादी पर एक कविता लिखो')).toBe(true);
    expect(isNoSearchRequest('Bana dünya hakkında bir şiir yaz')).toBe(true);
  });

  it('reads a year, a model number or a web address as a lookup', () => {
    expect(isNoSearchRequest('Write a poem about the 1998 World Cup')).toBe(
      false
    );
    expect(isNoSearchRequest('Write a review of the Galaxy S25')).toBe(false);
    expect(isNoSearchRequest('Translate www.zorblax.com into Polish')).toBe(
      false
    );
    expect(isNoSearchRequest('Write a poem about zorblax.pl')).toBe(false);
  });

  it('ignores numbers inside code, which is material to work on', () => {
    expect(
      isNoSearchRequest('Fix this code: `const limit = 2048; return limit`')
    ).toBe(true);
  });

  it('leaves a request the lexicon does not recognise to the planner', () => {
    expect(isNoSearchRequest('Who wrote the poem The Raven?')).toBe(false);
    expect(isNoSearchRequest('Kto napisał wiersz Lokomotywa?')).toBe(false);
  });
});
