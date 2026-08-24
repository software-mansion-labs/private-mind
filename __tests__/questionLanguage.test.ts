import {
  detectQuestionLanguage,
  detectThreadLanguage,
} from '../utils/questionLanguage';
import {
  MULTILINGUAL_SCENARIOS,
  ALL_LANGS,
} from './fixtures/multilingualQueries';

const codeOf = (question: string) =>
  detectQuestionLanguage(question)?.code ?? null;

describe('detectQuestionLanguage — Polish typed without diacritics', () => {
  it.each([
    'Znajdz najdrozsza oferte karty graficznej rtx 5080 na xkom',
    'ktory sklep ma najlepsza cene rtx 5080',
    'pokaz najtansze bilety do Krakowa',
  ])('names Polish for %s', (question) => {
    expect(detectQuestionLanguage(question)?.code).toBe('pl');
  });
});

describe('detectQuestionLanguage', () => {
  it('names Polish from function words alone, without diacritics', () => {
    expect(codeOf('Kto jest kanclerzem Niemiec?')).toBe('pl');
    expect(codeOf('jaka jest dzisiaj pogoda w Gdansku')).toBe('pl');
  });

  it('names Polish from diacritics', () => {
    expect(codeOf('najświeższe wiadomości ze świata')).toBe('pl');
  });

  it('never mistakes diacritic-free Polish for Portuguese', () => {
    for (const question of [
      'Znajdz najdrozsza oferte karty graficznej rtx 5080 na xkom',
      'najlepsza pizza na wynos w Krakowie',
      'ceny mieszkan na rynku wtornym',
    ]) {
      expect(['pl', null]).toContain(codeOf(question));
    }
  });

  it('still names Portuguese from its own function words', () => {
    expect(codeOf('quanto custa uma placa de video hoje')).toBe('pt');
  });

  it('names English', () => {
    expect(codeOf('Who is the chancellor of Germany?')).toBe('en');
    expect(codeOf('what is the weather in London today')).toBe('en');
  });

  it('names German', () => {
    expect(codeOf('Wer ist der Kanzler von Deutschland?')).toBe('de');
  });

  it('names French and Spanish', () => {
    expect(codeOf('Qui est le chancelier et pourquoi maintenant?')).toBe('fr');
    expect(codeOf('¿Quién es el canciller de Alemania hoy?')).toBe('es');
  });

  it('splits Russian from Ukrainian by their exclusive letters', () => {
    expect(codeOf('Кто сейчас канцлер Германии?')).toBe('ru');
    expect(codeOf('Хто зараз канцлер Німеччини?')).toBe('uk');
  });

  it('names the whole-script languages from their script alone', () => {
    expect(codeOf('जर्मनी के चांसलर कौन हैं?')).toBe('hi');
    expect(codeOf('谁是德国总理')).toBe('zh');
    expect(codeOf('ドイツの首相は誰ですか')).toBe('ja');
    expect(codeOf('독일 총리는 누구입니까')).toBe('ko');
  });

  it('splits Urdu, Persian and Arabic within the Arabic script', () => {
    expect(codeOf('جرمنی کا چانسلر کون ہے؟')).toBe('ur');
    expect(codeOf('صدراعظم آلمان کیست؟')).toBe('fa');
    expect(codeOf('من هو مستشار ألمانيا؟')).toBe('ar');
  });

  it('names Portuguese', () => {
    expect(codeOf('Quem é o presidente do Brasil hoje?')).toBe('pt');
  });

  it('names Polish for oblique-case question words that collide with a Turkish word', () => {
    expect(codeOf('Kim był Kazimierz Wielki i czego dokonał?')).toBe('pl');
    expect(codeOf('Komu podlega prezes NBP?')).toBe('pl');
  });

  it('still names Turkish for its own "kim" questions', () => {
    expect(codeOf('kimlik kartı nasıl alınır')).toBe('tr');
  });

  it('names Polish when a short verb ("ma") coincidentally scores as an exclusive French marker (live-found Pixel gap)', () => {
    expect(codeOf('ile dzieci ma elon musk')).toBe('pl');
  });

  it('still names French for its own short-word questions', () => {
    expect(codeOf('quel temps fait-il à Paris')).toBe('fr');
  });

  it("never lets a short, coincidentally-exclusive word override another language's real marker (systematic audit, not a single-case fix)", () => {
    const shortExclusive: [string, string][] = [
      ['of', 'en'],
      ['in', 'en'],
      ['my', 'en'],
      ['me', 'en'],
      ['it', 'en'],
      ['wo', 'de'],
      ['nu', 'nl'],
      ['en', 'nl'],
      ['ik', 'nl'],
      ['le', 'fr'],
      ['du', 'fr'],
      ['ma', 'fr'],
      ['es', 'es'],
      ['el', 'es'],
      ['yo', 'es'],
      ['il', 'it'],
      ['io', 'it'],
      ['os', 'pt'],
      ['da', 'pt'],
      ['em', 'pt'],
      ['no', 'pt'],
      ['ce', 'ro'],
      ['se', 'ro'],
      ['ne', 'tr'],
    ];
    const decisiveMarker: Record<string, string> = {
      en: 'who',
      pl: 'kto',
      cs: 'kdo',
      de: 'wer',
      nl: 'wat',
      fr: 'qui',
      es: 'quién',
      it: 'chi',
      pt: 'quem',
      ro: 'cine',
      tr: 'hangi',
      id: 'siapa',
    };

    const wrongGuesses: string[] = [];
    for (const [shortToken, shortOwner] of shortExclusive) {
      for (const [targetLang, marker] of Object.entries(decisiveMarker)) {
        if (targetLang === shortOwner) continue;
        const sentence = `${shortToken} ${marker}`;
        const got = codeOf(sentence);
        if (got === shortOwner) {
          wrongGuesses.push(
            `"${sentence}" named ${shortOwner} (owner of "${shortToken}") instead of ${targetLang} (owner of "${marker}") or null`
          );
        }
      }
    }
    expect(wrongGuesses).toEqual([]);
  });

  it('returns null when unsure instead of guessing', () => {
    expect(codeOf('Gdansk Berlin 2026')).toBeNull();
    expect(codeOf('ok')).toBeNull();
    expect(codeOf('')).toBeNull();
  });

  it('returns the English name used in the prompt', () => {
    expect(detectQuestionLanguage('Kto jest kanclerzem Niemiec?')?.name).toBe(
      'Polish'
    );
  });

  it('names the languages a shared accent used to hand to a neighbour', () => {
    expect(codeOf('bugün altın fiyatı ne kadar')).toBe('tr');
    expect(codeOf('preço da gasolina hoje')).toBe('pt');
    expect(codeOf('quando è la prossima partita di campionato')).toBe('it');
    expect(codeOf('harga emas hari ini')).toBe('id');
    expect(codeOf('hoeveel kost een paspoort in Nederland')).toBe('nl');
  });

  it('names the script only where the answer could be transliterated', () => {
    expect(detectQuestionLanguage('जर्मनी के चांसलर कौन हैं?')?.script).toBe(
      'Devanagari script'
    );
    expect(detectQuestionLanguage('Кто сейчас канцлер Германии?')?.script).toBe(
      'Cyrillic script'
    );
    expect(
      detectQuestionLanguage('Who is the chancellor of Germany?')?.script
    ).toBeUndefined();
  });

  it('reads the language off the thread when the newest message is opaque', () => {
    expect(
      detectThreadLanguage(['jaka jest dzisiaj pogoda w Gdansku', 'a jutro?'])
        ?.code
    ).toBe('pl');
    expect(
      detectThreadLanguage([
        'jaka jest dzisiaj pogoda',
        'and what about tomorrow in London?',
      ])?.code
    ).toBe('en');
    expect(detectThreadLanguage(['2026', 'ok'])).toBeNull();
  });
});

describe('detectQuestionLanguage over the multilingual corpus', () => {
  const results = MULTILINGUAL_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    lang: scenario.lang,
    got: detectQuestionLanguage(scenario.query)?.code ?? null,
  }));

  it('never names a language other than the one the question is written in', () => {
    const wrong = results.filter((r) => r.got !== null && r.got !== r.lang);
    expect(wrong.map((r) => `${r.id}: ${r.lang}->${r.got}`)).toEqual([]);
  });

  it('names the language for every language we ship to', () => {
    const perLanguage = ALL_LANGS.map((lang) => {
      const items = results.filter((r) => r.lang === lang);
      const named = items.filter((r) => r.got === lang).length;
      return `${lang}=${Math.round((100 * named) / items.length)}%`;
    });
    expect(perLanguage.filter((entry) => !entry.endsWith('=100%'))).toEqual([]);
  });
});
