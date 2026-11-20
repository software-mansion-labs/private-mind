import {
  detectQuestionLanguage,
  detectThreadLanguage,
  WORDS,
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

  it('reads an inflected form of a word it knows in the base form', () => {
    expect(codeOf('Cuantos habitantes tiene Barcelona')).toBe('es');
    expect(codeOf('Wie viele Einwohner hat Muenchen')).toBe('de');
  });

  it('reads umlauts typed as the ASCII digraphs a phone keyboard offers', () => {
    expect(codeOf('Welche Zutaten braucht man fuer Kaesespaetzle')).toBe('de');
    expect(codeOf('Wie sind die Oeffnungszeiten vom Museum')).toBe('de');
  });

  it('breaks a tie on the longer word rather than giving up', () => {
    expect(codeOf('Jam buka Candi Borobudur pukul berapa')).toBe('id');
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

describe('detectThreadLanguage across scripts', () => {
  it('does not anchor an undetected Latin-script question to an earlier Urdu turn', () => {
    expect(
      detectThreadLanguage([
        'زمین سورج کے گرد کیوں گھومتی ہے؟',
        'Lighthouse keeper, 300 words.',
      ])
    ).toBeNull();
  });

  it('still inherits a Latin-script language for a short Latin follow-up', () => {
    expect(
      detectThreadLanguage([
        'jaka jest dzisiaj pogoda w Gdansku',
        'Lighthouse keeper, 300 words.',
      ])?.code
    ).toBe('pl');
  });

  it('takes the latest turn when its script is detected on its own', () => {
    expect(
      detectThreadLanguage([
        'Write a 300-word story about a lighthouse keeper.',
        'زمین سورج کے گرد کیوں گھومتی ہے؟',
      ])?.code
    ).toBe('ur');
  });
});

describe('detectQuestionLanguage on English requests without question words', () => {
  it.each([
    'Write a 300-word story about a lighthouse keeper.',
    'Tell me about your day.',
    'Explain this to a child.',
  ])('detects English in %s', (question) => {
    expect(detectQuestionLanguage(question)?.code).toBe('en');
  });
});

describe('detectQuestionLanguage — French from #508', () => {
  it.each([
    'Explique moi',
    'Explique-moi cette carte en français',
    'Décris ce circuit',
    'le moi',
  ])('names French for %s', (question) => {
    expect(codeOf(question)).toBe('fr');
  });

  it('keeps French for a thread whose latest message is a photo with no text', () => {
    expect(detectThreadLanguage(["Qu'est-ce que c'est ?", ''])?.code).toBe(
      'fr'
    );
  });
});

const listedWords = (code: string): string[] =>
  WORDS[code]!.toLowerCase().normalize('NFC').split(/\s+/);

const withoutMarks = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');

const LATIN_WORD = /^\p{Script=Latin}+$/u;
const TYPED_WITHOUT_DIACRITICS = /^[a-z]+$/;

describe('detectQuestionLanguage — words that match only without their diacritics', () => {
  it('never gives a listed word to a language that does not list it', () => {
    const misread = Object.keys(WORDS).flatMap((code) =>
      listedWords(code)
        .filter((word) => word.length >= 2)
        .flatMap((word) => {
          const found = codeOf(word);
          return found && found !== code && !listedWords(found).includes(word)
            ? [`${word} (${code}) → ${found}`]
            : [];
        })
    );

    expect(misread).toEqual([]);
  });

  it('lets a word spelled as listed outweigh one that matches only without its diacritics', () => {
    const everyListed = new Set(Object.keys(WORDS).flatMap(listedWords));
    const bareOnly = Object.keys(WORDS).flatMap((owner) =>
      listedWords(owner)
        .map((word) => ({ owner, word, bare: withoutMarks(word) }))
        .filter(
          ({ word, bare }) =>
            bare !== word &&
            bare.length >= 2 &&
            TYPED_WITHOUT_DIACRITICS.test(bare) &&
            !everyListed.has(bare)
        )
    );
    const misread = Object.keys(WORDS).flatMap((code) =>
      listedWords(code)
        .filter((word) => word.length >= 3 && LATIN_WORD.test(word))
        .filter((word) => codeOf(word) === code)
        .slice(0, 3)
        .flatMap((anchor) =>
          bareOnly
            .filter(({ owner }) => owner !== code)
            .map(({ owner, bare }) => ({ owner, phrase: `${anchor} ${bare}` }))
            .filter(({ owner, phrase }) => codeOf(phrase) === owner)
            .map(({ owner, phrase }) => `${phrase} (${code}) → ${owner}`)
        )
    );

    expect(misread).toEqual([]);
  });
});

describe('detectQuestionLanguage — languages that share words with French keep their own', () => {
  it.each([
    ['mới nhất hôm nay', 'vi'],
    ['tôi muốn biết thời tiết', 'vi'],
    ['tôi là ai'.normalize('NFD'), 'vi'],
    ['mới nhất'.normalize('NFD'), 'vi'],
    ['thoi tiet hom nay', 'vi'],
    ['dzis wieczorem', 'pl'],
    ['wiadomosci z polski', 'pl'],
    ['pocasi dnes', 'cs'],
    ['zpravy zitra', 'cs'],
    ['pret benzina maine', 'ro'],
    ['stiri azi', 'ro'],
    ['bugun hava durumu', 'tr'],
    ['sinav nasil', 'tr'],
    ['de auto en de fiets', 'nl'],
    ['ce faci', 'ro'],
  ])('names %s as %s', (question, code) => {
    expect(codeOf(question)).toBe(code);
  });

  it.each([
    'Plus size clothes',
    'sans serif font',
    'Turn on the light',
    'my son is sick',
  ])('never reads the English %s as French', (question) => {
    expect(codeOf(question)).not.toBe('fr');
  });

  it('reads Persian and Urdu words written with a madda or hamza', () => {
    expect(codeOf('آیا')).toBe('fa');
    expect(codeOf('آج')).toBe('ur');
  });
});

describe('detectQuestionLanguage — requests to the assistant', () => {
  it.each([
    ['Explain photosynthesis in simple terms', 'en'],
    ['Translate this to French please', 'en'],
    ['przetlumacz to na angielski', 'pl'],
    ['opisz to zdjecie', 'pl'],
    ['Beschreibe dieses Bild', 'de'],
    ['Gib mir drei Ideen fürs Abendessen', 'de'],
    ['Raconte-moi une blague', 'fr'],
    ['merci beaucoup', 'fr'],
    ['Cuéntame un chiste', 'es'],
    ['Descrivi questa immagine', 'it'],
    ['Descreva esta imagem', 'pt'],
    ['Descrie această imagine', 'ro'],
    ['Popiš tento obrázek', 'cs'],
    ['Bu belgeyi özetle', 'tr'],
    ['Jelaskan gambar ini', 'id'],
    ['Tóm tắt tài liệu này', 'vi'],
    ['Beschrijf deze afbeelding', 'nl'],
  ])('names %s as %s', (question, code) => {
    expect(codeOf(question)).toBe(code);
  });
});

describe('detectQuestionLanguage — cases found while checking #508 for regressions', () => {
  it('reads the language of a question, not of a word it quotes', () => {
    expect(codeOf('Was bedeutet "merci"?')).toBe('de');
    expect(codeOf('Jak się mówi „thank you” po francusku?')).toBe('pl');
  });

  it('keeps a stem shared by two languages from deciding a proper name', () => {
    expect(codeOf('Apakah besok hujan di Jakarta?')).toBe('id');
  });

  it('lets a longer diacritic-free word outweigh a two-letter one', () => {
    expect(codeOf('va ploua maine in bucuresti')).toBe('ro');
  });

  it('never reads Spanish or Portuguese that shares a word with French as French', () => {
    expect(codeOf('Dame tres ideas para la cena')).not.toBe('fr');
    expect(codeOf('Explique a fotossíntese de forma simples')).not.toBe('fr');
  });
});
