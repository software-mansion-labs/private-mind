import {
  isCircularNonAnswer,
  stripEchoedQuestionPrefix,
  assembleSourceDocuments,
  buildMessageSources,
  detectGroundingCaveats,
  humanizeSourceReferences,
  stripSourceLabels,
  isDanglingListAnswer,
  isQuestionEchoAnswer,
  isWrongLanguageAnswer,
  looksLikeNoAnswer,
  mergeAttachmentFirst,
  pickCitationsByAnswer,
  restrictCitationsToContext,
  visibleAnswer,
  type SourceRow,
} from '../utils/messageSources';
import { SourceDocument } from '../database/chatRepository';
import { formatContextChunks } from '../utils/contextUtils';
import { hybridRetrieve } from '../utils/hybridRetrieval';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

jest.mock('../utils/hybridRetrieval', () => ({
  hybridRetrieve: jest.fn().mockResolvedValue([]),
}));

const mockHybridRetrieve = hybridRetrieve as jest.Mock;

const doc = (documentId: number | undefined, name: string): SourceDocument => ({
  documentId,
  name,
});

describe('mergeAttachmentFirst', () => {
  it('leads with retrieved attachment docs, then the rest', () => {
    const retrieved = [doc(1, 'old.pdf'), doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(
      retrieved,
      [doc(2, 'attachment.txt')],
      [2]
    );

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
  });

  it('cites an attachment that produced no retrieved chunk, using its overview', () => {
    const retrieved = [doc(1, 'old.pdf')];
    const preferred = [doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(retrieved, preferred, [2]);

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
    expect(result).toHaveLength(2);
  });

  it('does not duplicate an attachment that was both retrieved and preferred', () => {
    const retrieved = [doc(2, 'attachment.txt')];
    const preferred = [doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(retrieved, preferred, [2]);

    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe(2);
  });

  it('does not collide two undefined-id sources onto one slot', () => {
    const retrieved = [doc(undefined, 'a.pdf'), doc(undefined, 'b.pdf')];
    const result = mergeAttachmentFirst(retrieved, [], [7]);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.name)).toEqual(['a.pdf', 'b.pdf']);
  });
});

describe('assembleSourceDocuments', () => {
  const source = (
    id: number,
    name: string,
    firstChunk?: string
  ): SourceRow => ({
    id,
    name,
    firstChunk,
  });

  it('returns the merged citations when retrieval produced sources', () => {
    const retrieved = [doc(1, 'old.pdf'), doc(2, 'attachment.txt')];
    const result = assembleSourceDocuments(
      retrieved,
      [doc(2, 'attachment.txt')],
      [2],
      [source(1, 'old.pdf'), source(2, 'attachment.txt')],
      true
    );

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
  });

  it('links the active document when context was sent but nothing was cited', () => {
    const result = assembleSourceDocuments(
      [],
      [],
      [],
      [source(9, 'report.pdf', 'overview text')],
      true
    );

    expect(result).toEqual([
      { documentId: 9, name: 'report.pdf', passage: 'overview text' },
    ]);
  });

  it('stays empty when no context reached the model', () => {
    const result = assembleSourceDocuments(
      [],
      [],
      [],
      [source(9, 'report.pdf', 'overview text')],
      false
    );

    expect(result).toEqual([]);
  });
});

describe('restrictCitationsToContext', () => {
  const cite = (documentId: number, name: string): SourceDocument => ({
    documentId,
    name,
  });
  const block = (documentId: number, name: string, document: string) => ({
    document,
    similarity: 0.8,
    metadata: { documentId, name },
  });

  it('drops documents whose block was truncated out of the prompt', () => {
    const cited = [
      cite(21, 'polityka_urlopowa_2026.pdf'),
      cite(20, 'sample.htm'),
      cite(19, '_10-K-2025-As-Filed.pdf'),
    ];
    const prompt = formatContextChunks([
      block(21, 'polityka_urlopowa_2026.pdf', 'vacation'),
    ]).join(' ');

    const result = restrictCitationsToContext(cited, prompt, [
      doc(21, 'polityka_urlopowa_2026.pdf'),
    ]);

    expect(result.map((d) => d.documentId)).toEqual([21]);
  });

  it('keeps every document whose block survived', () => {
    const cited = [cite(1, 'a.pdf'), cite(2, 'b.pdf')];
    const prompt = formatContextChunks([
      block(1, 'a.pdf', 'x'),
      block(2, 'b.pdf', 'y'),
    ]).join(' ');

    const result = restrictCitationsToContext(cited, prompt, []);

    expect(result.map((d) => d.documentId)).toEqual([1, 2]);
  });

  it('keeps the leading citation when nothing matched the prompt', () => {
    const cited = [cite(1, 'a.pdf'), cite(2, 'b.pdf')];

    const result = restrictCitationsToContext(cited, 'no headers here', []);

    expect(result.map((d) => d.documentId)).toEqual([1]);
  });

  it('passes through a single citation untouched', () => {
    const cited = [cite(1, 'a.pdf')];

    expect(restrictCitationsToContext(cited, '', [])).toEqual(cited);
  });
});

describe('pickCitationsByAnswer', () => {
  const withPassage = (
    documentId: number,
    name: string,
    passage: string
  ): SourceDocument => ({ documentId, name, passage });

  it('cites only the source the answer actually echoes', () => {
    const cited = [
      withPassage(
        22,
        'sample.html',
        'The quarterly revenue report and profit summary.'
      ),
      withPassage(24, 'sample.csv', 'employee,vacation,days\nAnna,urlop,26'),
    ];
    const answer = 'Anna ma 26 dni urlopu według danych o pracownikach.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId)).toEqual([24]);
  });

  it('does not cite a source for a fact the answer says it lacks', () => {
    const cited = [
      withPassage(
        1,
        'revenue.txt',
        'Total revenue grew to five million dollars.'
      ),
      withPassage(2, 'headcount.txt', 'The company hired forty new engineers.'),
    ];
    const answer = 'The report does not mention revenue.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result).toEqual([]);
  });

  it('keeps the asserted half of a sentence and drops the negated half', () => {
    const cited = [
      withPassage(
        1,
        'revenue.txt',
        'Total revenue grew to five million dollars.'
      ),
      withPassage(2, 'headcount.txt', 'The company hired forty new engineers.'),
    ];
    const answer =
      'The company hired forty engineers, but the report does not mention total revenue or the five million dollars figure.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId)).toEqual([2]);
  });

  it('keeps both sources when the answer draws on each', () => {
    const cited = [
      withPassage(
        1,
        'revenue.txt',
        'Total revenue grew to five million dollars.'
      ),
      withPassage(2, 'headcount.txt', 'The company hired forty new engineers.'),
    ];
    const answer =
      'Revenue grew to five million dollars while the company hired forty engineers.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId).sort()).toEqual([1, 2]);
  });

  it('never drops the freshly-attached source the answer does not echo', () => {
    const cited = [
      withPassage(1, 'other.txt', 'Revenue grew to five million dollars.'),
      withPassage(
        2,
        'attachment.txt',
        'Completely unrelated attached content.'
      ),
    ];
    const answer = 'Revenue grew to five million dollars.';

    const result = pickCitationsByAnswer(cited, answer, [
      doc(2, 'attachment.txt'),
    ]);

    expect(result.map((d) => d.documentId).sort()).toEqual([1, 2]);
  });

  it('drops all citations when the answer echoes no passage (refusal)', () => {
    const cited = [
      withPassage(1, 'sample.pdf', 'alpha beta gamma'),
      withPassage(2, 'misja_ares_trzy.pdf', 'delta epsilon zeta'),
    ];

    const result = pickCitationsByAnswer(
      cited,
      'W dokumentach nie ma informacji o L4.',
      []
    );

    expect(result).toEqual([]);
  });

  it('cites nothing on a refusal, even with a fresh attachment', () => {
    const cited = [
      withPassage(1, 'library.pdf', 'alpha beta gamma'),
      withPassage(2, 'attachment.pdf', 'delta epsilon zeta'),
    ];

    const result = pickCitationsByAnswer(
      cited,
      'There is no information about L4 here.',
      [doc(2, 'attachment.pdf')]
    );

    expect(result).toEqual([]);
  });

  it('cites nothing on a refusal even when only one source was cited', () => {
    const cited = [withPassage(1, 'report.pdf', 'alpha beta gamma')];

    const result = pickCitationsByAnswer(cited, "I don't know.", []);

    expect(result).toEqual([]);
  });

  it('passes through a single citation untouched', () => {
    const cited = [withPassage(1, 'a.txt', 'alpha beta gamma')];

    expect(pickCitationsByAnswer(cited, 'anything at all', [])).toEqual(cited);
  });

  it('ignores the <think> block and attributes only the visible reply', () => {
    const cited = [
      withPassage(1, 'sample.pdf', 'alpha beta gamma'),
      withPassage(2, 'misja_ares_trzy.pdf', 'delta epsilon zeta'),
    ];
    const answer =
      '<think>The alpha beta gamma file and the delta epsilon zeta file both ' +
      'need checking for L4.</think>W dokumentach nie ma informacji o L4.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result).toEqual([]);
  });

  it('cites nothing when a verbose refusal still overlaps the passages', () => {
    const cited = [
      withPassage(
        1,
        'sample.pdf',
        'The report covers revenue and profit figures.'
      ),
      withPassage(
        2,
        'misja_ares_trzy.pdf',
        'The mission Ares III briefing and crew roster.'
      ),
    ];
    const answer =
      'Przeanalizowałem dokumenty: sample.pdf opisuje revenue i profit, a misja ' +
      'Ares III to briefing i crew roster. W żadnym nie ma informacji o L4.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result).toEqual([]);
  });

  it('attributes to the source the visible reply echoes, not the reasoning', () => {
    const cited = [
      withPassage(1, 'sample.pdf', 'alpha beta gamma'),
      withPassage(2, 'misja_ares_trzy.pdf', 'delta epsilon zeta'),
    ];
    const answer =
      '<think>Compare alpha beta gamma against delta epsilon zeta.</think>' +
      'The mission file covers delta, epsilon and zeta in detail.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId)).toEqual([2]);
  });
});

describe('web search results (experimental)', () => {
  const web = (name: string, url: string, passage: string): SourceDocument => ({
    name,
    url,
    passage,
    kind: 'web',
  });
  const localDoc = (
    documentId: number,
    name: string,
    passage: string
  ): SourceDocument => ({ documentId, name, passage });

  it('pickCitationsByAnswer keeps every web result even on a refusal', () => {
    const cited = [
      localDoc(1, 'library.pdf', 'alpha beta gamma'),
      localDoc(2, 'other.pdf', 'delta epsilon zeta'),
      web('Reanimated', 'https://docs.swmansion.com/x', 'smooth animations'),
      web('DuckDuckGo', 'https://duckduckgo.com/privacy', 'no tracking'),
    ];

    const result = pickCitationsByAnswer(
      cited,
      'There is no information about L4 here.',
      []
    );

    expect(result.filter((d) => d.kind !== 'web')).toEqual([]);
    expect(result.filter((d) => d.kind === 'web').map((d) => d.name)).toEqual([
      'Reanimated',
      'DuckDuckGo',
    ]);
  });

  it('pickCitationsByAnswer keeps web results alongside a cited local doc', () => {
    const cited = [
      localDoc(1, 'revenue.txt', 'Total revenue grew to five million dollars.'),
      web('Reanimated', 'https://docs.swmansion.com/x', 'smooth animations'),
    ];

    const result = pickCitationsByAnswer(
      cited,
      'Revenue grew to five million dollars.',
      []
    );

    expect(result.map((d) => d.name)).toEqual(['revenue.txt', 'Reanimated']);
  });

  it('flags the web result the answer echoes as used, leaving off-topic ones unused', () => {
    const cited = [
      web(
        'Weather Warsaw',
        'https://w.com',
        'Warsaw temperature and rain forecast today'
      ),
      web(
        'Cooking recipes',
        'https://c.com',
        'Best pasta carbonara recipe with eggs'
      ),
    ];
    const answer =
      'The weather in Warsaw shows rain and a low temperature today.';

    const result = pickCitationsByAnswer(cited, answer, []);
    const usedByName = Object.fromEntries(result.map((d) => [d.name, d.used]));

    expect(usedByName['Weather Warsaw']).toBe(true);
    expect(usedByName['Cooking recipes']).toBe(false);
  });

  it('does not flag a web result used when it was truncated out of the prompt', () => {
    const cited = [
      web(
        'Weather Warsaw',
        'https://w.com',
        'Warsaw temperature and rain forecast today'
      ),
    ];
    const answer =
      'The weather in Warsaw shows rain and a low temperature today.';

    const result = pickCitationsByAnswer(cited, answer, [], new Set<string>());

    expect(result[0].used).toBe(false);
  });

  it('flags a web result used only when its name is present in the prompt', () => {
    const cited = [
      web(
        'Weather Warsaw',
        'https://w.com',
        'Warsaw temperature and rain forecast today'
      ),
    ];
    const answer =
      'The weather in Warsaw shows rain and a low temperature today.';

    const result = pickCitationsByAnswer(
      cited,
      answer,
      [],
      new Set(['Weather Warsaw'])
    );

    expect(result[0].used).toBe(true);
  });

  it('falls back to trusting fetched web results when the answer language shares no words with them (F3)', () => {
    const cited = [
      web(
        'Vitamin D for the Prevention of Disease | Endocrine Society',
        'https://endocrine.org/x',
        'The Endocrine Society recommends adults take 600 to 800 IU of vitamin D daily.'
      ),
      web(
        'The 2024 Endocrine Society Guideline on Vitamin D - MDPI',
        'https://mdpi.com/x',
        'This guideline reviews evidence for vitamin D supplementation in adults.'
      ),
    ];
    const answer =
      'Zalecana dzienna dawka witaminy D dla dorosłych według najnowszych ' +
      'wytycznych to witamina D w dawkach niższych niż 1000 IU.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.every((d) => d.used)).toBe(true);
  });

  it('still hides a web result absent from the prompt even when overlap is uninformative', () => {
    const cited = [
      web(
        'Vitamin D for the Prevention of Disease | Endocrine Society',
        'https://endocrine.org/x',
        'The Endocrine Society recommends adults take 600 to 800 IU of vitamin D daily.'
      ),
    ];
    const answer =
      'Zalecana dzienna dawka witaminy D dla dorosłych to witamina D.';

    const result = pickCitationsByAnswer(cited, answer, [], new Set<string>());

    expect(result[0].used).toBe(false);
  });

  it('marks no web result used when the answer is a refusal', () => {
    const cited = [
      web('Weather Warsaw', 'https://w.com', 'Warsaw temperature and rain'),
    ];

    const result = pickCitationsByAnswer(
      cited,
      'There is no information about that in the sources.',
      []
    );

    expect(result[0].used).toBe(false);
  });

  it('restrictCitationsToContext always retains web results', () => {
    const cited = [
      { documentId: 1, name: 'a.pdf' } as SourceDocument,
      web('Reanimated', 'https://docs.swmansion.com/x', 'smooth animations'),
    ];

    const result = restrictCitationsToContext(cited, 'no headers here', []);

    expect(result.map((d) => d.name)).toContain('Reanimated');
  });
});

describe('visibleAnswer', () => {
  it('drops a complete think block, keeping text before and after', () => {
    expect(visibleAnswer('before<think>hidden reasoning</think>after')).toBe(
      'before after'
    );
  });

  it('drops an unterminated think block (streaming) entirely', () => {
    expect(visibleAnswer('visible<think>still reasoning')).toBe('visible');
  });

  it('returns the text unchanged when there is no think block', () => {
    expect(visibleAnswer('plain answer')).toBe('plain answer');
  });

  it('drops every think block, not just the first', () => {
    expect(
      visibleAnswer(
        'one<think>hidden</think>two<think>also hidden</think>three'
      )
    ).toBe('one two three');
  });
});

describe('looksLikeNoAnswer', () => {
  it.each([
    'W dokumentach nie ma informacji o L4.',
    'Brak informacji na ten temat w załączonych plikach.',
    'Dokument nie zawiera danych o urlopie.',
    'Nie wiem, o tym nie ma mowy.',
    'Nie ma dokumentu z tematem "L4" w kontekście dostanych materiałów. Informacje zamieszczone w źródłach obejmują tylko raport testowy.',
    'There is no information about L4 in the documents.',
    'There is no mention of sick leave anywhere.',
    'Sick leave is not mentioned in the provided documents.',
    'The file does not contain any information about L4.',
    "I don't know — the context does not cover this.",
    'That detail is not found in the provided sources.',
    'Adres siedziby glownej spolki Zephyria nie jest określony w podanym kontekście.',
    'Data premiery nie została podana w dokumencie.',
    'Te szczegóły nie są wskazane w załączonych materiałach.',
    'Na podstawie dostarczonych kontekstów nie jest podany adres siedziby głównej spółki Zephyria.',
    'W dokumencie nie jest określona data premiery.',
    'Nie ma dokładnej informacji o aktualnej pogodzie w kontekście źródeł, które zostały podane.',
    'There is no exact information about the current weather in the sources provided.',
    'Źródła nie dostarczają konkretnej informacji o pogodzie w danym momencie.',
  ])('flags the refusal: %s', (reply) => {
    expect(looksLikeNoAnswer(reply)).toBe(true);
  });

  it.each([
    'The company has no debt and reported a five million profit.',
    'Firma nie ma zadłużenia, a zysk wyniósł pięć milionów.',
    'Nie ma limitu urlopu — polityka pozwala na 30 dni w roku.',
    'Polityka nie zawiera kar umownych za zwłokę.',
    'Document A covers revenue; it does not mention costs, which are in B.',
    'Anna ma 26 dni urlopu zgodnie z regulaminem.',
    'The mission launches on Tuesday with a crew of three.',
    'Urlop dodatkowy nie jest płatny, co potwierdza regulamin.',
  ])('does not flag a real answer: %s', (reply) => {
    expect(looksLikeNoAnswer(reply)).toBe(false);
  });
});

describe('detectGroundingCaveats', () => {
  describe('figure caveat', () => {
    it('flags an answer that states a figure absent from the context', () => {
      const context = 'Ethereum Price: $1,901.25 (0.20%) | ETH';
      const answer = 'Aktualna cena Ethereum wynosi około $50,000 USD.';
      expect(detectGroundingCaveats(answer, undefined, context)).toEqual([
        'figure',
      ]);
    });

    it('does not flag an answer whose figure matches the context', () => {
      const context = 'Bitcoin price today: $64,146.36 USD.';
      const answer = 'Aktualna cena Bitcoin wynosi około $64,146.36 USD.';
      expect(detectGroundingCaveats(answer, undefined, context)).toEqual([]);
    });

    it('does not flag an answer with no currency figure', () => {
      const answer = 'It is sunny in Warsaw today.';
      expect(
        detectGroundingCaveats(answer, undefined, 'Some context.')
      ).toEqual([]);
    });
  });

  describe('trend caveat', () => {
    const question = 'Ktory zyskal wiecej procentowo w tym miesiacu?';
    const context =
      'Bitcoin price today: $64,146.36. Ethereum price today: $1,899.62.';

    it('flags a trend claim with no change data in context', () => {
      const answer = 'Bitcoin zyskał więcej procentowo w tym miesiącu.';
      expect(detectGroundingCaveats(answer, question, context)).toEqual([
        'trend',
      ]);
    });

    it('does not flag it when the context has period-matched change data', () => {
      const answer = 'Bitcoin zyskał więcej procentowo w tym miesiącu.';
      const grounded =
        'Bitcoin is up 12% this month, Ethereum is up 4% this month.';
      expect(detectGroundingCaveats(answer, question, grounded)).toEqual([]);
    });

    it('does not flag an answer with no comparative trend claim', () => {
      const answer =
        'Bitcoin price today: $64,146.36. Ethereum price today: $1,899.62.';
      expect(detectGroundingCaveats(answer, question, context)).toEqual([]);
    });

    it('does not flag it when the question was not about a trend', () => {
      const answer = 'Bitcoin zyskał więcej procentowo w tym miesiącu.';
      expect(
        detectGroundingCaveats(answer, 'What is the bitcoin price?', context)
      ).toEqual([]);
    });
  });

  describe('conversion caveat', () => {
    const question = 'And how much is that in euros?';
    const noRateContext =
      '1 USD to EUR - Convert US dollars to Euros | Wise. ' +
      '1 Euro to US dollars Exchange Rate. Convert EUR/USD - Wise.';

    it('flags a conversion figure with no real rate in context', () => {
      const answer = 'The price of 1 USD in euros is 1.00.';
      expect(detectGroundingCaveats(answer, question, noRateContext)).toEqual([
        'conversion',
      ]);
    });

    it('does not flag it when the context has a genuine conversion rate', () => {
      const answer = 'That is approximately €1,450.00.';
      const grounded =
        '1 USD = 0.92 EUR as of today, so that converts to approximately €1,450.00.';
      expect(detectGroundingCaveats(answer, question, grounded)).toEqual([]);
    });

    it('does not flag an answer with no currency figure', () => {
      const answer = 'I do not have a verified exchange rate to convert that.';
      expect(detectGroundingCaveats(answer, question, noRateContext)).toEqual(
        []
      );
    });

    it('does not flag it when the question was not a conversion follow-up', () => {
      const answer = 'The price of 1 USD in euros is 1.00.';
      expect(
        detectGroundingCaveats(
          answer,
          'What is the current gold price?',
          noRateContext
        )
      ).toEqual([]);
    });
  });

  it('can flag more than one caveat kind at once', () => {
    const answer =
      'Bitcoin zyskał więcej procentowo w tym miesiącu i teraz kosztuje $50,000.';
    const context = 'Bitcoin price today: $64,146.36 USD.';
    expect(
      detectGroundingCaveats(
        answer,
        'Ktory zyskal wiecej procentowo w tym miesiacu?',
        context
      )
    ).toEqual(['figure', 'trend']);
  });
});

describe('isQuestionEchoAnswer — diacritics (live-found)', () => {
  it('catches an echo the model spelled with proper Polish diacritics', () => {
    expect(
      isQuestionEchoAnswer(
        'Czy warto go kupić teraz, czy poczekać na promocje?',
        'Czy warto go kupic teraz, czy poczekac na promocje?'
      )
    ).toBe(true);
    expect(
      isQuestionEchoAnswer(
        'A gdzie kupię najtaniej?',
        'A gdzie kupie najtaniej?'
      )
    ).toBe(true);
  });

  it('still does not call a real answer an echo', () => {
    expect(
      isQuestionEchoAnswer(
        'Warto poczekać — promocja kończy się 6 września.',
        'Czy warto go kupic teraz, czy poczekac na promocje?'
      )
    ).toBe(false);
  });
});

describe('isQuestionEchoAnswer', () => {
  it('flags an answer that is just the question echoed back after a think block', () => {
    const question = 'Ile wazy i jakie ma wymiary?';
    const answer = '<think>\n\n</think>\n\nIle wazy i jakie ma wymiary?';
    expect(isQuestionEchoAnswer(answer, question)).toBe(true);
  });

  it('flags a plain echo with no think block and different trailing punctuation', () => {
    expect(
      isQuestionEchoAnswer(
        'Ile wazy i jakie ma wymiary',
        'Ile wazy i jakie ma wymiary?'
      )
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(
      isQuestionEchoAnswer(
        'ILE WAZY I JAKIE MA WYMIARY?',
        'Ile wazy i jakie ma wymiary?'
      )
    ).toBe(true);
  });

  it('does not flag a genuine answer', () => {
    const question = 'Ile wazy i jakie ma wymiary?';
    const answer = '<think>\n\n</think>\n\nLaptop waży 2.5 kg.';
    expect(isQuestionEchoAnswer(answer, question)).toBe(false);
  });

  it('does not flag when there is no question to compare against', () => {
    expect(isQuestionEchoAnswer('Some answer.', undefined)).toBe(false);
  });

  it('does not flag when the answer is entirely inside an unclosed think block', () => {
    const question = 'Ile wazy i jakie ma wymiary?';
    const answer = '<think>Ile wazy i jakie ma wymiary?';
    expect(isQuestionEchoAnswer(answer, question)).toBe(false);
  });

  it('flags an echo with a leaked trailing "(Answer in X.)" reminder', () => {
    const question = 'Kiedy urodził się Macron?';
    const answer = 'Kiedy urodził się Macron? (Odpowiedź w polskim.)';
    expect(isQuestionEchoAnswer(answer, question)).toBe(true);
  });

  it('does not flag a genuine answer that happens to end in a parenthetical', () => {
    const question = 'Kiedy urodził się Macron?';
    const answer = 'Macron urodził się 21 grudnia 1977 roku (we Francji).';
    expect(isQuestionEchoAnswer(answer, question)).toBe(false);
  });
});

describe('isWrongLanguageAnswer', () => {
  const question = 'Kim był Kazimierz Wielki i czego dokonał?';

  it('flags the captured live failure — a Polish question answered in Turkish', () => {
    const answer =
      "Kazimierz Wielki (1310–1370) Polska'nın en son piastıydı. Panlari, " +
      "hukukun kodifikasyonu, Kraków'da universitetin kurulumu ve büyük " +
      'inşaat projeleriyle polsada "drewni" ve "murowan" hale gelmesi ' +
      'anlatılır.';
    expect(isWrongLanguageAnswer(answer, question)).toBe(true);
  });

  it('does not flag a genuine answer in the question language', () => {
    const answer =
      'Kazimierz Wielki był ostatnim królem Polski z dynastii Piastów. ' +
      'Skodyfikował prawo, założył Akademię Krakowską i rozbudował kraj.';
    expect(isWrongLanguageAnswer(answer, question)).toBe(false);
  });

  it('does not flag a Polish answer that merely contains foreign proper nouns', () => {
    const answer =
      'Najtańszy bilet z Warszawy do Londynu oferuje linia Ryanair, według ' +
      'wyszukiwarki Skyscanner.';
    expect(isWrongLanguageAnswer(answer, question)).toBe(false);
  });

  it('does not flag when the answer is too short/numeric to confidently detect a language', () => {
    expect(isWrongLanguageAnswer('128 zł–181 zł', question)).toBe(false);
  });

  it('does not flag when the question language cannot be confidently detected', () => {
    expect(isWrongLanguageAnswer('This is a genuine answer.', '?')).toBe(false);
  });

  it('does not flag when there is no question to compare against', () => {
    expect(isWrongLanguageAnswer('Some answer.', undefined)).toBe(false);
  });

  it('only detects the answer language outside the think block', () => {
    const answer =
      '<think>some English reasoning here about the topic</think>\n\n' +
      'Kazimierz Wielki był ostatnim królem Polski z dynastii Piastów.';
    expect(isWrongLanguageAnswer(answer, question)).toBe(false);
  });
});

describe('humanizeSourceReferences', () => {
  const webDoc = (documentId: number, name: string): SourceDocument => ({
    documentId,
    name,
    kind: 'web',
  });

  it('replaces the exact captured live regression — four numbered citations across one answer', () => {
    const sourceDocuments = [
      webDoc(1, "Elon Musk's 14 Children: Names, Ages, Moms – Parade"),
      webDoc(2, 'Every Woman Elon Musk Has Children With – People.com'),
      webDoc(3, "All About Elon Musk's 14 Kids and Their 4 Moms – InStyle"),
      webDoc(4, "Elon Musk's 14 Children: All About the Tesla CEO's Kids"),
    ];
    const answer =
      "The search results contain information about Elon Musk's children, " +
      'specifically mentioning his 14 children with four different women ' +
      '(Source 1), and welcomed 14 children over 20 years (Source 2), and ' +
      'is stated as the father of 14 children (Source 3), and details ' +
      'about the family are given (Source 4).';
    const result = humanizeSourceReferences(answer, sourceDocuments);
    expect(result).toContain(
      "(Elon Musk's 14 Children: Names, Ages, Moms – Parade)"
    );
    expect(result).toContain(
      '(Every Woman Elon Musk Has Children With – People.com)'
    );
    expect(result).not.toMatch(/Source \d/);
  });

  it('replaces a Polish "źródło N" reference the same way', () => {
    const sourceDocuments = [webDoc(1, 'Reuters'), webDoc(2, 'CoinMarketCap')];
    const answer = 'Według źródła 2, cena wynosi 100 zł.';
    expect(humanizeSourceReferences(answer, sourceDocuments)).toBe(
      'Według CoinMarketCap, cena wynosi 100 zł.'
    );
  });

  it('leaves an out-of-range number untouched rather than guessing', () => {
    const sourceDocuments = [webDoc(1, 'Reuters')];
    const answer = 'As stated in Source 5, the price is rising.';
    expect(humanizeSourceReferences(answer, sourceDocuments)).toBe(answer);
  });

  it('leaves ordinary text untouched when there is nothing to replace', () => {
    const answer = 'The president has two daughters.';
    expect(humanizeSourceReferences(answer, [webDoc(1, 'Reuters')])).toBe(
      answer
    );
  });

  it('is a no-op when there are no source documents at all', () => {
    const answer = 'As stated in Source 1, the price is rising.';
    expect(humanizeSourceReferences(answer, [])).toBe(answer);
  });
});

describe('isDanglingListAnswer', () => {
  it('flags the captured live failure — a list intro with no items after it', () => {
    const answer = 'Prezydent ma dwie córki. Ich imiona to:';
    expect(isDanglingListAnswer(answer)).toBe(true);
  });

  it('flags an English list intro left dangling', () => {
    expect(
      isDanglingListAnswer('The president has two daughters. They are:')
    ).toBe(true);
  });

  it('does not flag when the list is actually filled in', () => {
    const answer = 'Prezydent ma dwie córki. Ich imiona to: Anna i Maria.';
    expect(isDanglingListAnswer(answer)).toBe(false);
  });

  it('does not flag an ordinary answer with no trailing colon', () => {
    expect(isDanglingListAnswer('Prezydent ma dwie córki.')).toBe(false);
  });

  it('does not flag an empty response', () => {
    expect(isDanglingListAnswer('')).toBe(false);
  });

  it('only checks the visible answer, not a trailing colon left inside <think>', () => {
    const answer =
      '<think>let me think about this:</think>\n\nPrezydent ma dwie córki.';
    expect(isDanglingListAnswer(answer)).toBe(false);
  });

  it('flags a bare trailing list marker with nothing after it (dash)', () => {
    const answer = 'Rzeczy do zabrania na wyjazd\n-';
    expect(isDanglingListAnswer(answer)).toBe(true);
  });

  it('flags a bare trailing numbered marker with nothing after it', () => {
    const answer = 'Oto co warto spakować\n1.';
    expect(isDanglingListAnswer(answer)).toBe(true);
  });

  it('flags a bare trailing bullet marker with nothing after it', () => {
    const answer = 'Things to pack\n•';
    expect(isDanglingListAnswer(answer)).toBe(true);
  });

  it('does not flag a normal sentence that happens to contain a hyphen', () => {
    const answer = 'Kup bilet w tanim terminie - polecam LOT.';
    expect(isDanglingListAnswer(answer)).toBe(false);
  });

  it('does not flag a completed list whose last item starts with a marker', () => {
    const answer = 'Rzeczy do zabrania:\n1. Paszport\n2. Bilet lotniczy';
    expect(isDanglingListAnswer(answer)).toBe(false);
  });
});

describe('buildMessageSources retrieval query', () => {
  const vectorStore = {} as OPSQLiteVectorStore;
  const sources: SourceRow[] = [{ id: 1, name: 'report.pdf' }];
  const baseParams = {
    attachmentSourceIds: [],
    enabledSources: [1],
    sources,
    vectorStore,
  };

  beforeEach(() => {
    mockHybridRetrieve.mockClear();
    mockHybridRetrieve.mockResolvedValue([]);
  });

  it('retrieves with the raw query when it is not referentially incomplete', async () => {
    await buildMessageSources({
      ...baseParams,
      userInput: 'jaka jest cena bitcoina?',
      history: [
        { role: 'user', content: 'kto jest prezydentem usa?' },
        { role: 'assistant', content: 'Donald Trump.' },
      ],
      digest: 'Topic: some unrelated digest.',
    });

    expect(mockHybridRetrieve.mock.calls[0][0].prompt).toBe(
      'jaka jest cena bitcoina?'
    );
  });

  it('falls back to the digest for a referentially incomplete query with no entity in history', async () => {
    await buildMessageSources({
      ...baseParams,
      userInput: 'ile ma lat prezydent?',
      history: [
        { role: 'user', content: 'hej, jak leci?' },
        { role: 'assistant', content: 'Wszystko dobrze, dzięki!' },
      ],
      digest: 'Topic: the president discussed in the attached report.',
    });

    expect(mockHybridRetrieve.mock.calls[0][0].prompt).toBe(
      'ile ma lat prezydent? Topic: the president discussed in the attached report.'
    );
  });

  it('leaves the query unchanged when there is no digest and no history', async () => {
    await buildMessageSources({
      ...baseParams,
      userInput: 'ile ma lat prezydent?',
    });

    expect(mockHybridRetrieve.mock.calls[0][0].prompt).toBe(
      'ile ma lat prezydent?'
    );
  });
});

describe('a source reference names the host, not the page title (live: Pixel S4.1)', () => {
  const sources = [
    {
      name: 'Ile mieszkańców ma Warszawa w 2025 roku? Aktualne dane',
      kind: 'web' as const,
      url: 'https://www.wp.pl/artykul/warszawa',
    },
    { name: 'raport.pdf', documentId: 3 },
  ];

  it('does not splice a question-shaped title into the sentence', () => {
    expect(
      humanizeSourceReferences(
        'Według źródła 1, Warszawa ma 1,86 mln.',
        sources
      )
    ).toBe('Według wp.pl, Warszawa ma 1,86 mln.');
  });

  it('keeps a document’s own name, which is what the user attached', () => {
    expect(humanizeSourceReferences('See Source 2.', sources)).toBe(
      'See raport.pdf.'
    );
  });
});

describe('stripSourceLabels (live: Pixel S3.1)', () => {
  it('removes a copied "[Answers: …]" block label with its dash', () => {
    expect(
      stripSourceLabels(
        '[Answers: cena iPhone 17 Pro w złotych] - iPhone 17 Pro kosztuje 5021,9 PLN.'
      )
    ).toBe('iPhone 17 Pro kosztuje 5021,9 PLN.');
  });

  it('removes every label, wherever the model pasted it', () => {
    expect(
      stripSourceLabels(
        'W PLN: [Answers: cena w złotych] 5021,9 PLN. W EUR: [Answers: cena w euro]: brak danych.'
      )
    ).toBe('W PLN: 5021,9 PLN. W EUR: brak danych.');
  });

  it('leaves an answer without labels untouched', () => {
    expect(stripSourceLabels('Cena to 5021,9 PLN [1].')).toBe(
      'Cena to 5021,9 PLN [1].'
    );
  });
});

describe('humanizeSourceReferences — Polish declension (live-found)', () => {
  const sources = [
    {
      name: 'Kurs złota i srebra (notowania)',
      kind: 'web' as const,
      url: 'https://a.example',
    },
    { name: 'CoinMarketCap', kind: 'web' as const, url: 'https://b.example' },
  ];

  it('replaces the locative "w źródle 1", not only "źródło 1"', () => {
    expect(
      humanizeSourceReferences('Kurs można sprawdzić w źródle 1.', sources)
    ).toBe('Kurs można sprawdzić w a.example.');
  });

  it('still replaces the forms it already handled', () => {
    expect(humanizeSourceReferences('Zgodnie ze źródłem 2.', sources)).toBe(
      'Zgodnie ze b.example.'
    );
    expect(humanizeSourceReferences('See Source 2.', sources)).toBe(
      'See b.example.'
    );
  });

  it('leaves a number with no matching source alone', () => {
    expect(humanizeSourceReferences('w źródle 9', sources)).toBe('w źródle 9');
  });
});

describe('stripEchoedQuestionPrefix — the model restating the question first', () => {
  it('drops a verbatim question prefix and keeps the answer (live-found)', () => {
    expect(
      stripEchoedQuestionPrefix(
        'A jaki ma aparat? Aparat Samsunga Galaxy S25 to 48MP.',
        'A jaki ma aparat?'
      )
    ).toBe('Aparat Samsunga Galaxy S25 to 48MP.');
  });

  it('drops it from behind a think block, which is what is actually stored', () => {
    expect(
      stripEchoedQuestionPrefix(
        '<think>\n\n</think>\n\nA jaki ma aparat? Aparat to 48MP.',
        'A jaki ma aparat?'
      )
    ).toBe('<think>\n\n</think>\n\nAparat to 48MP.');
  });

  it('drops a restated opening question and the "Odpowiedź:" label', () => {
    const answer =
      'Czy warto go kupic teraz, czy poczekac na promocje?\n' +
      'Odpowiedź:\n' +
      'Dla nowych modeli warto poczekać na wrześniową promocję.';
    expect(
      stripEchoedQuestionPrefix(
        answer,
        'Czy warto go kupic teraz, czy poczekac na promocje?'
      )
    ).toBe('Dla nowych modeli warto poczekać na wrześniową promocję.');
  });

  it('leaves a restatement that resolves the pronoun, because it adds words the question never had', () => {
    const answer =
      'Czy warto kupić Samsung Galaxy S25 teraz, czy poczekać na promocje?\n' +
      'Dla nowych modeli warto poczekać.';
    expect(
      stripEchoedQuestionPrefix(
        answer,
        'Czy warto go kupic teraz, czy poczekac na promocje?'
      )
    ).toBe(answer);
  });

  it("leaves an opening question that is not the user's own", () => {
    const answer =
      'Czy wiesz, ile kosztuje dostawa?\nCena telefonu to 2499 zl.';
    expect(
      stripEchoedQuestionPrefix(answer, 'Ile kosztuje Samsung Galaxy S25?')
    ).toBe(answer);
  });

  it("does not cut when the answer continues the question's own sentence", () => {
    const answer = 'Cena bitcoina dzisiaj to $64,949.96 USD.';
    expect(stripEchoedQuestionPrefix(answer, 'Cena bitcoina dzisiaj')).toBe(
      answer
    );
  });

  it('does not cut a lead-in that merely contains the question', () => {
    const answer =
      'Tekst piosenki Sobty - Hej, jak leci?: Hej, jak leci? Czy wodka zaprawiasz?';
    expect(stripEchoedQuestionPrefix(answer, 'Hej, jak leci?')).toBe(answer);
  });

  it('cuts a restated question that sits inline before the answer (live-found)', () => {
    const answer =
      'Jaka tam jest pogoda? W miesiacu wrzesniu w Barcelonie zachmurzenie wzrasta z 29% do 42%.';
    expect(
      stripEchoedQuestionPrefix(
        answer,
        'Planuje wyjazd do Barcelony we wrzesniu, jaka tam jest pogoda?'
      )
    ).toBe(
      'W miesiacu wrzesniu w Barcelonie zachmurzenie wzrasta z 29% do 42%.'
    );
  });

  it('keeps a pure echo intact, so the echo guard still sees it', () => {
    expect(
      stripEchoedQuestionPrefix('A jaki ma aparat?', 'A jaki ma aparat?')
    ).toBe('A jaki ma aparat?');
  });

  it('leaves an answer that merely starts with similar words alone', () => {
    const answer = 'A jaki ma aparat ten model? Nie wiem.';
    expect(stripEchoedQuestionPrefix(answer, 'A jaki ma pamięć?')).toBe(answer);
  });

  it('is a no-op without a question', () => {
    expect(stripEchoedQuestionPrefix('Cena to 3999 zł.', undefined)).toBe(
      'Cena to 3999 zł.'
    );
  });
});

describe('isCircularNonAnswer — an answer that only talks about its sources', () => {
  it('flags a reply that keeps pointing at the sources without naming one', () => {
    expect(
      isCircularNonAnswer(
        'Informacje pochodzą ze źródeł podanych wyżej. Źródła opisują to dokładnie, ' +
          'a szczegóły są w źródłach.'
      )
    ).toBe(true);
    expect(
      isCircularNonAnswer(
        'The sources describe it that way. The sources cover it, and the sources agree.'
      )
    ).toBe(true);
  });

  it('counts Polish source words in every inflection, including "źródeł"', () => {
    expect(
      isCircularNonAnswer('ze źródeł, w źródłach, zgodnie ze źródłami')
    ).toBe(true);
  });

  it('does not count numbered citations, which are the style the prompt asks for (live-found)', () => {
    expect(
      isCircularNonAnswer(
        'Cena wynosi 684,80 zł (źródło 1), a cyna 32 500 zł (źródło 2), ' +
          'zgodnie ze źródłem 3.'
      )
    ).toBe(false);
    expect(
      isCircularNonAnswer(
        'Source 1 lists 162 g, Source 2 lists 146.9 x 70.5 x 7.2 mm, and Source 3 agrees.'
      )
    ).toBe(false);
  });

  it('leaves an answer that cites a source once or twice alone', () => {
    expect(
      isCircularNonAnswer(
        'Cena wynosi 3200 zł (źródło 1), a dostawa jest darmowa.'
      )
    ).toBe(false);
  });

  it('ignores mentions that only appear inside a think block', () => {
    expect(
      isCircularNonAnswer(
        '<think>źródło źródło źródło</think>Cena wynosi 3200 zł.'
      )
    ).toBe(false);
  });

  it('is false for an empty answer', () => {
    expect(isCircularNonAnswer('')).toBe(false);
  });
});
