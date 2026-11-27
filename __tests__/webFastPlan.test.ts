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
import { lacksSearchSignal } from '../utils/web/noSearchSignal';
import { NO_SEARCH_LEXICONS } from '../utils/web/noSearchLexicon';
import { COORDINATION_LEXICONS } from '../utils/web/coordinationLexicon';
import { hasStopwordCoverage } from '../utils/queryTerms';
import { clearWebCaches } from '../utils/web/cache/webCache';
import { DEFAULT_PROFILE } from '../constants/model-profiles';
import { WEB_QUERY_MAX_CHARS } from '../constants/web';

const QUESTION = 'Who founded Zorblax Industries in 1987?';

const REQUESTS_BY_LANGUAGE = [
  {
    language: 'en',
    writing: 'Write a short story about a dragon',
    opinion: 'Should I learn the guitar or the piano?',
    factual: 'Who wrote the poem The Raven?',
  },
  {
    language: 'pl',
    writing: 'Opowiedz mi bajkę o smoku',
    opinion: 'Czy powinienem kupić nowy laptop?',
    factual: 'Kto wygrał finał Ligi Mistrzów w 2025 roku?',
  },
  {
    language: 'de',
    writing: 'Kannst du mir ein Gedicht über den Herbst schreiben?',
    opinion: 'Was hältst du von Homeoffice?',
    factual: 'Wer hat den Nobelpreis für Physik 2023 gewonnen?',
  },
  {
    language: 'nl',
    writing: 'Kun je een gedicht over de zee schrijven?',
    opinion: 'Wat vind je van thuiswerken?',
    factual: 'Wie won de Tour de France in 2023?',
  },
  {
    language: 'fr',
    writing: 'Écris un poème sur la mer',
    opinion: 'Que penses-tu du télétravail ?',
    factual: 'Qui a gagné la Coupe du monde de rugby en 2023 ?',
  },
  {
    language: 'es',
    writing: '¿Puedes escribir un poema sobre el mar?',
    opinion: '¿Qué opinas del teletrabajo?',
    factual: '¿Quién ganó el Mundial de fútbol en 2010?',
  },
  {
    language: 'pt',
    writing: "Traduza 'obrigado' para o inglês",
    opinion: 'O que você acha da inteligência artificial?',
    factual: 'Quem ganhou a Copa do Mundo de 2002?',
  },
  {
    language: 'it',
    writing: 'Scrivi una poesia sulla città di Roma',
    opinion: 'Cosa ne pensi del lavoro da remoto?',
    factual: 'Chi ha vinto il Festival di Sanremo nel 2024?',
  },
  {
    language: 'ro',
    writing: 'Scrie o poezie despre mare',
    opinion: 'Ce părere ai despre munca de acasă?',
    factual: 'Cine a câștigat alegerile prezidențiale din România în 2024?',
  },
  {
    language: 'cs',
    writing: 'Napiš báseň o moři',
    opinion: 'Co si myslíš o práci z domova?',
    factual: 'Kdo vyhrál mistrovství světa v hokeji v roce 2024?',
  },
  {
    language: 'ru',
    writing: "Переведи 'спасибо' на английский",
    opinion: 'Что ты думаешь о новом iPhone 17 Pro?',
    factual: 'Кто выиграл чемпионат мира по футболу в 2018 году?',
  },
  {
    language: 'uk',
    writing: 'Напиши вірш про осінь',
    opinion: 'Що ти думаєш про роботу з дому?',
    factual: 'Хто переміг на Євробаченні у 2022 році?',
  },
  {
    language: 'el',
    writing: 'Γράψε ένα ποίημα για τη θάλασσα',
    opinion: 'Τι πιστεύεις για την τηλεργασία;',
    factual: 'Ποιος κέρδισε το Euro 2004;',
  },
  {
    language: 'ar',
    writing: 'اكتب قصيدة عن البحر',
    opinion: 'ما رأيك في العمل عن بعد؟',
    factual: 'من فاز بكأس العالم لكرة القدم عام 2022؟',
  },
  {
    language: 'he',
    writing: 'כתוב שיר על הים',
    opinion: 'מה דעתך על עבודה מהבית?',
    factual: 'מי זכה בפרס נובל לספרות בשנת 2016?',
  },
  {
    language: 'hi',
    writing: 'क्या आप बारिश पर एक कविता लिख सकते हैं?',
    opinion: 'घर से काम करने के बारे में आप क्या सोचते हैं?',
    factual: '2011 क्रिकेट विश्व कप किसने जीता?',
  },
  {
    language: 'ur',
    writing: "'شکریہ' کا انگریزی میں ترجمہ کریں",
    opinion: 'گھر سے کام کرنے کے بارے میں آپ کی رائے کیا ہے؟',
    factual: '2017 چیمپئنز ٹرافی کس نے جیتی؟',
  },
  {
    language: 'bn',
    writing: 'বৃষ্টি নিয়ে একটি কবিতা লেখো',
    opinion: 'বাড়ি থেকে কাজ করা নিয়ে আপনার মতামত কী?',
    factual: '২০২২ সালে ফুটবল বিশ্বকাপ কে জিতেছে?',
  },
  {
    language: 'fa',
    writing: "'ممنون' را به انگلیسی ترجمه کن",
    opinion: 'نظر شما درباره کار از خانه چیست؟',
    factual: 'جام جهانی فوتبال ۲۰۲۲ را چه کسی برد؟',
  },
  {
    language: 'tr',
    writing: 'İstanbul hakkında kısa bir şiir yaz',
    opinion: 'Evden çalışma hakkında ne düşünüyorsun?',
    factual: '2023 Eurovision şarkı yarışmasını kim kazandı?',
  },
  {
    language: 'id',
    writing: 'Tuliskan puisi pendek tentang kota Jakarta',
    opinion: 'Apa pendapatmu tentang kerja dari rumah?',
    factual: 'Siapa yang memenangkan Piala Dunia 2022?',
  },
  {
    language: 'ko',
    writing: '바다에 대한 시를 써줘',
    opinion: '재택근무에 대해 어떻게 생각해?',
    factual: '2022년 월드컵에서 누가 우승했나요?',
  },
];

const KEYWORD_LANGUAGES = REQUESTS_BY_LANGUAGE.filter(({ language }) =>
  hasStopwordCoverage(language)
);
const LANGUAGES_WITHOUT_KEYWORD_REDUCTION = REQUESTS_BY_LANGUAGE.filter(
  ({ language }) => !hasStopwordCoverage(language)
);
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

  it('decides not to search a request with nothing to look up, without asking the planner', async () => {
    const run = search("Translate 'thank you' into Hindi");
    const { telemetry } = await run.done;

    expect(run.generate).not.toHaveBeenCalled();
    expect(telemetry.skippedReason).toBe('no-search-request');
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

  it.each(LANGUAGES_WITHOUT_KEYWORD_REDUCTION)(
    'defers a factual question in a language with no stopword coverage ($language)',
    ({ factual }) => {
      expect(fastPlanWebSearch(factual, [])).toBeNull();
    }
  );

  it('recognises the Italian, Turkish, Indonesian and Russian writing and opinion requests it once deferred by language alone', () => {
    for (const [language, request] of [
      ['it', 'Scrivi una poesia sulla città di Roma'],
      ['tr', 'İstanbul hakkında kısa bir şiir yaz'],
      ['id', 'Tuliskan puisi pendek tentang kota Jakarta'],
      ['ru', 'Что ты думаешь о новом iPhone 17 Pro?'],
    ] as const) {
      expect(lacksSearchSignal(request, language)).toBe(true);
      expect(fastPlanWebSearch(request, [])).toBeNull();
    }
    for (const question of [
      'Chi ha vinto il Festival di Sanremo nel 2024?',
      'Nutuk kitabını kim yazdı?',
      'Siapa yang memenangkan Piala Dunia 2022?',
      'Кто выиграл чемпионат мира по футболу в 2018 году?',
      'Kto wygrał finał Ligi Mistrzów w 2025 roku?',
    ]) {
      expect(fastPlanWebSearch(question, [])).not.toBeNull();
    }
  });

  it.each([
    { language: 'fa', question: 'نظرت درباره دورکاری چیه؟' },
    { language: 'es', question: 'Traduce "gracias" al alemán, por favor' },
  ])(
    'defers a request that reads as a lookalike language ($language): $question',
    ({ question }) => {
      expect(fastPlanWebSearch(question, [])).toBeNull();
    }
  );

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
    { language: 'en', question: 'Tell me a joke about cats' },
    { language: 'en', question: 'Can you give me a funny poem about Mondays?' },
    { language: 'en', question: 'Proofread my email to the landlord' },
    { language: 'en', question: 'What is 15 times 23?' },
    { language: 'hi', question: 'मुझे एक चुटकुला सुनाओ' },
    { language: 'hi', question: 'इस वाक्य को अंग्रेज़ी में अनुवाद कर दो' },
    { language: 'ur', question: 'کیا آپ میرے لیے ایک غزل لکھ سکتے ہیں؟' },
    { language: 'ur', question: 'مجھے ایک لطیفہ سناؤ' },
    { language: 'de', question: 'Erzähl mir einen Witz über Katzen' },
    { language: 'de', question: 'Sollte ich Gitarre oder Klavier lernen?' },
    { language: 'pl', question: 'Ile to jest 15 razy 23?' },
    { language: 'es', question: 'Cuéntame un chiste de gatos' },
    { language: 'fr', question: 'Raconte-moi une blague sur les chats' },
    { language: 'ar', question: 'هل يمكنك كتابة قصيدة عن البحر؟' },
    { language: 'tr', question: 'Bana bir fıkra anlat' },
    { language: 'id', question: 'Ceritakan sebuah dongeng tentang kancil' },
  ])(
    'defers a request with no search signal to the planner ($language): $question',
    ({ question }) => {
      expect(fastPlanWebSearch(question, [])).toBeNull();
    }
  );

  it.each([
    { language: 'en', question: 'Who wrote the poem The Raven?' },
    { language: 'en', question: 'How much water should I drink a day?' },
    { language: 'en', question: 'Tell me which song won Eurovision 2024' },
    { language: 'en', question: 'Correct dosage of ibuprofen for children' },
    { language: 'en', question: 'Fix for Windows update error 0x80070005' },
    { language: 'en', question: 'Can you tell me how to fix a leaking tap?' },
    { language: 'en', question: 'Best app to translate Japanese menus' },
    { language: 'pl', question: 'Kto napisał wiersz Lokomotywa?' },
    { language: 'pl', question: 'Ile wody powinienem pić dziennie?' },
    { language: 'pl', question: 'Jak napisać CV po angielsku?' },
    { language: 'de', question: 'Wer schrieb das Gedicht Erlkönig?' },
    { language: 'de', question: 'Wie schreibt man eine Bewerbung?' },
    { language: 'es', question: '¿Cómo se escribe una carta formal?' },
    { language: 'fr', question: 'Qui a écrit le poème Le Lac ?' },
    { language: 'hi', question: 'रामायण का अंग्रेज़ी अनुवाद किसने किया?' },
    { language: 'hi', question: 'आवेदन पत्र कैसे लिखें?' },
    { language: 'hi', question: 'भारत के राष्ट्रगान को किसने लिखा?' },
    { language: 'ur', question: 'علامہ اقبال نے کون سی نظم لکھی؟' },
    { language: 'ar', question: 'من كتب قصيدة البردة؟' },
    { language: 'tr', question: "Bu yaz İstanbul'da hava nasıl olacak?" },
    { language: 'id', question: 'Siapa yang menulis lagu Indonesia Raya?' },
  ])(
    'still plans a factual question that uses a writing or opinion word ($language): $question',
    ({ question }) => {
      expect(fastPlanWebSearch(question, [])).not.toBeNull();
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

describe('the no-search lexicon', () => {
  it('covers the languages the question splitter covers', () => {
    expect(Object.keys(NO_SEARCH_LEXICONS).sort()).toEqual(
      Object.keys(COORDINATION_LEXICONS).sort()
    );
    expect(REQUESTS_BY_LANGUAGE.map(({ language }) => language).sort()).toEqual(
      Object.keys(NO_SEARCH_LEXICONS).sort()
    );
  });

  it.each(REQUESTS_BY_LANGUAGE)(
    'recognises a writing or translation request ($language): $writing',
    ({ language, writing }) => {
      expect(lacksSearchSignal(writing, language)).toBe(true);
    }
  );

  it.each(REQUESTS_BY_LANGUAGE)(
    'recognises an opinion or advice request ($language): $opinion',
    ({ language, opinion }) => {
      expect(lacksSearchSignal(opinion, language)).toBe(true);
    }
  );

  it.each(REQUESTS_BY_LANGUAGE)(
    'finds a search signal in a factual question ($language): $factual',
    ({ language, factual }) => {
      expect(lacksSearchSignal(factual, language)).toBe(false);
    }
  );

  it.each(KEYWORD_LANGUAGES)(
    'defers the writing and opinion requests and plans the factual question ($language)',
    ({ writing, opinion, factual }) => {
      expect(fastPlanWebSearch(writing, [])).toBeNull();
      expect(fastPlanWebSearch(opinion, [])).toBeNull();
      expect(fastPlanWebSearch(factual, [])).not.toBeNull();
    }
  );
});
