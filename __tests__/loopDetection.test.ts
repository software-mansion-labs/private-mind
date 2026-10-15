import {
  hasRunawayLoop,
  isRepetitionFromTheStart,
  truncateAtRepeatedClause,
} from '../utils/loopDetection';

describe('truncateAtRepeatedClause', () => {
  it.each([
    'Hi!',
    'Hi! Hi!',
    'Cześć! Cześć!',
    'नमस्ते! नमस्ते!',
    'Thanks! Thanks!',
  ])('leaves a short greeting like %j alone', (greeting) => {
    expect(truncateAtRepeatedClause(greeting)).toBe(greeting);
  });

  it('cuts the answer where a clause starts repeating back-to-back', () => {
    const text =
      'Najważniejsze wydarzenia na świecie w tym tygodniu obejmują: ' +
      'wzrost wzajemnych wymagań w Wietnie, zwiększenie opadów deszczów w Wyspach, ' +
      'wypadek w Szwecji, wypadek w Szwecji, a także wypadek w Szwecji.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('wypadek w Szwecji, wypadek w Szwecji');
    expect(result.endsWith('wypadek w Szwecji,')).toBe(true);
  });

  it('leaves normal prose with no repeated clause untouched', () => {
    const text =
      'Cena bitcoina to $64,146.36, a cena ethereum to $1,899.62. ' +
      'Bitcoin zyskał więcej procentowo w tym miesiącu.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('does not flag two different clauses that merely share a short prefix', () => {
    const text =
      'Zwiększ aktywność fizyczną każdego dnia, zmniejsz spożycie cukru w diecie.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('does not flag short clauses below the minimum length', () => {
    const text = 'Nie, nie, to nieprawda.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('tolerates the same fact restated later in different wording', () => {
    const text =
      'Cena bitcoina to $64,146.36. Podsumowując, aktualna cena bitcoina wynosi $64,146.36.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('catches a loop across newline-separated list items', () => {
    const text =
      'Podsumowanie:\n' +
      'Wzrost cen paliw w regionie,\n' +
      'Wzrost cen paliw w regionie,\n' +
      'Nowe informacje wkrótce.';
    const result = truncateAtRepeatedClause(text);
    expect(result).toBe('Podsumowanie:\nWzrost cen paliw w regionie,');
  });

  it('cuts a padded list where whole items come back later, keeping the distinct ones (live-found)', () => {
    const text =
      'Oto lista 6 rzeczy, które powinieneś zabrać na tygodniowy wyjazd do Londynu:\n' +
      '1. Paliwo – wymagane do podróży.\n' +
      '2. Ochłonienie – np. kawa, herbatka, czekolada.\n' +
      '3. Oświetlenie – np. lampa, lampka, kajuta.\n' +
      '4. Ogół – np. lód, krem, krem na twarz.\n' +
      '5. Oświetlenie – np. lampa, lampka, kajuta.\n' +
      '6. Ochłonienie – np. kawa, herbatka, czekolada.';
    const result = truncateAtRepeatedClause(text);
    expect(result).toContain('1. Paliwo');
    expect(result).toContain('2. Ochłonienie');
    expect(result).toContain('3. Oświetlenie');
    expect(result).toContain('4. Ogół');
    expect(result).not.toContain('5. Oświetlenie');
    expect(result).not.toContain('6. Ochłonienie');
  });

  it('does not cut an answer that merely names the same thing twice (live-found regression)', () => {
    const text =
      'To bake a chocolate cake, you need flour, sugar, cocoa powder, eggs, milk, and baking powder.\n' +
      '1. Sift the flour and the cocoa powder into a bowl.\n' +
      '2. Add the sugar and the baking powder, then mix.\n' +
      '3. Beat in the eggs and the milk until smooth.\n' +
      '4. Bake for 30 minutes and let it cool before serving.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('needs a third occurrence before a repeated clause counts as a loop', () => {
    const twice =
      'Rynek krypto zachowuje się dziś stabilnie. Cena bitcoina wynosi dzisiaj 64146 dolarów. ' +
      'Ethereum zyskało więcej w tym miesiącu. Cena bitcoina wynosi dzisiaj 64146 dolarów.';
    expect(truncateAtRepeatedClause(twice)).toBe(twice);

    const thrice = `${twice} Rynek jest spokojny. Cena bitcoina wynosi dzisiaj 64146 dolarów.`;
    const result = truncateAtRepeatedClause(thrice);
    expect(result.match(/Cena bitcoina/g)).toHaveLength(1);
    expect(result).toContain('Ethereum zyskało');
    expect(result).not.toContain('Rynek jest spokojny');
  });

  it('cuts where the repetition starts, not where the content was first said', () => {
    const text =
      'Alfa to pierwszy istotny punkt tej odpowiedzi.\n' +
      'Beta to drugi istotny punkt tej odpowiedzi.\n' +
      'Gamma to trzeci istotny punkt tej odpowiedzi.\n' +
      'Delta to czwarty istotny punkt tej odpowiedzi.\n' +
      'Gamma to trzeci istotny punkt tej odpowiedzi.\n' +
      'Alfa to pierwszy istotny punkt tej odpowiedzi.';
    const result = truncateAtRepeatedClause(text);
    expect(result).toContain('Alfa to pierwszy');
    expect(result).toContain('Delta to czwarty');
    expect(result.match(/Alfa to pierwszy/g)).toHaveLength(1);
    expect(result.match(/Gamma to trzeci/g)).toHaveLength(1);
  });

  it('does not flag a list of genuinely distinct items with no duplicates', () => {
    const text =
      'Rzeczy do spakowania:\n' +
      '1. Paszport i dokumenty podróży.\n' +
      '2. Ładowarka do telefonu i powerbank.\n' +
      '3. Wygodne buty na długie spacery.\n' +
      '4. Lekka kurtka na chłodniejsze wieczory.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('does not flag two list items restating the same idea in different wording', () => {
    const text =
      '1. Zabierz ciepłą kurtkę na wieczory.\n' +
      '2. Pamiętaj o cieplejszym okryciu, gdy zrobi się chłodniej wieczorem.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('catches a loop across numbered list items whose marker resets clause memory (F22)', () => {
    const text =
      'Dokonał wielu reform, w tym:\n' +
      '1. **Reforma administracyjna** – zainicjował nowy podział kraju na województwa.\n' +
      '2. **Reforma administracyjna** – zainicjował nowy podział kraju na województwa.\n' +
      '3. **Reforma administracyjna** – zainicjował nowy podział kraju na województwa.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('2. **Reforma administracyjna**');
    expect(result).not.toContain('3. **Reforma administracyjna**');
    expect(result).toBe(
      'Dokonał wielu reform, w tym:\n' +
        '1. **Reforma administracyjna** – zainicjował nowy podział kraju na województwa.'
    );
  });

  it('catches a loop across numbered list items containing an internal comma (F23)', () => {
    const text =
      'Dokonał wielu ważnych działań i reform. W tym zakresie:\n' +
      '1. **Dokonał reform w systemie polskiego rządu** – zbudował system rządu, który był bardziej centralny i efektywny.\n' +
      '2. **Dokonał reform w systemie polskiego rządu** – zbudował system rządu, który był bardziej centralny i efektywny.\n' +
      '3. **Dokonał reform w systemie polskiego rządu** – zbudował system rządu, który był bardziej centralny i efektywny.\n\n' +
      'Wszystkie te działania przyczyniły się do rozwoju.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('2. **Dokonał reform');
    expect(result).not.toContain('3. **Dokonał reform');
    expect(result.endsWith('bardziej centralny i efektywny.')).toBe(true);
  });

  it('catches a cycling rotation of several different short clauses, not just an exact repeat (F24)', () => {
    const text =
      'Kameralar (Kimlik Kartı) genellikle resmi hizmetlerde bulunur: ' +
      'devlet merkezleri, kaza hizmetleri, sosyal güvenlik, sağlık hizmetleri, ' +
      'itibarlı kurumlar, kaza hizmetleri, sosyal güvenlik, sağlık hizmetleri, ' +
      'itibarlı kurumlar, kaza hizmetleri, sosyal güvenlik, sağlık hizmetleri, ' +
      'itibarlı kurumlar.';
    const result = truncateAtRepeatedClause(text);
    const secondCycleStart = result.indexOf(
      'kaza hizmetleri, sosyal güvenlik, sağlık hizmetleri, itibarlı kurumlar, kaza'
    );
    expect(secondCycleStart).toBe(-1);
    expect(result.endsWith('sağlık hizmetleri, itibarlı kurumlar,')).toBe(true);
  });

  it('returns the original text unchanged when nothing repeats', () => {
    const text = 'To jest krótka, normalna odpowiedź bez powtórzeń.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('cuts a single word looping with no punctuation between copies (F4)', () => {
    const text =
      'Zalecana dawka to witamina D w formie dostosowanego ' +
      'dostosowanego dostosowanego dostosowanego dostosowanego dostosowanego.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('dostosowanego dostosowanego');
    expect(result.endsWith('w formie dostosowanego')).toBe(true);
  });

  it('does not flag a word repeated only twice or three times', () => {
    const text = 'Bardzo bardzo bardzo lubię tę odpowiedź.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('does not flag short connector words repeated across normal prose', () => {
    const text =
      'Dawka zależy od wieku, a wiek to jeden z wielu czynników w tej sprawie.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('cuts a multi-word phrase looping with no punctuation between copies (F10)', () => {
    const text =
      'Odpowiedź brzmi: bardzo dobrze bardzo dobrze bardzo dobrze bardzo dobrze.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('bardzo dobrze bardzo dobrze');
    expect(result.endsWith('Odpowiedź brzmi: bardzo dobrze')).toBe(true);
  });

  it('cuts a three-word phrase looping with no punctuation between copies', () => {
    const text =
      'Wynik to: na pewno tak na pewno tak na pewno tak na pewno tak.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('na pewno tak na pewno tak');
    expect(result.endsWith('Wynik to: na pewno tak')).toBe(true);
  });

  it('does not flag a short two-word phrase repeated only twice', () => {
    const text = 'Bardzo dobrze bardzo dobrze to naprawdę świetna wiadomość.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('does not flag common short connector phrases reused across normal prose', () => {
    const text =
      'Tak jak wspomniano wcześniej, tak jak w poprzednim akapicie, dawka ' +
      'zależy od wieku pacjenta i tak jak zawsze warto skonsultować się z lekarzem.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });
});

describe('the cut keeps the first copy', () => {
  it('keeps the item that later items repeat, instead of eating it too', () => {
    const text =
      '6 najwyższych szczytów:\n' +
      '1. Góra Kamienna – 1530 m\n' +
      '2. Góra Szydłowska – 1480 m\n' +
      '3. Góra Złota – 1460 m\n' +
      '4. Góra Złota – 1460 m\n' +
      '5. Góra Złota – 1460 m';
    const result = truncateAtRepeatedClause(text);
    expect(result).toContain('3. Góra Złota – 1460 m');
    expect(result).not.toContain('4. Góra Złota');
    expect(result.split('Góra Złota').length - 1).toBe(1);
  });

  it('never ends on a bare list marker', () => {
    const text =
      'Lista:\n' +
      '1. Pierwsza pozycja tej listy.\n' +
      '2. Druga pozycja tej listy.\n' +
      '2. Druga pozycja tej listy.';
    const result = truncateAtRepeatedClause(text);
    expect(result.trimEnd()).not.toMatch(/(?:\d+[.)]|[-*•])\s*$/);
  });
});

describe('isRepetitionFromTheStart', () => {
  it('still flags a reply that is a loop from its first character', () => {
    expect(isRepetitionFromTheStart('cząstek cząstek cząstek cząstek')).toBe(
      true
    );
  });

  it('does not flag a reply that only loops after real content', () => {
    expect(
      isRepetitionFromTheStart(
        'Odpowiedź to 42. cząstek cząstek cząstek cząstek'
      )
    ).toBe(false);
  });

  it('is not moved by the cut now landing on the second copy', () => {
    const looping =
      'Powtarzam to zdanie. Powtarzam to zdanie. Powtarzam to zdanie.';
    expect(isRepetitionFromTheStart(looping)).toBe(true);
    expect(truncateAtRepeatedClause(looping)).toBe('Powtarzam to zdanie.');
  });
});

describe('a clause that ends several different sentences', () => {
  it.each([
    [
      'Hindi',
      '1. **नियमित समय पर सोएं**: रोज़ एक ही समय पर सोने जाएं, जिससे नींद बेहतर होती है।\n' +
        '2. **कैफीन से बचें**: शाम को चाय और कॉफी न पिएं, जिससे नींद बेहतर होती है।\n' +
        '3. **स्क्रीन बंद करें**: सोने से एक घंटा पहले फोन बंद करें, जिससे नींद बेहतर होती है।',
    ],
    [
      'Urdu',
      '1. **وقت پر سوئیں**: ہر روز ایک ہی وقت پر سونے جائیں، جس سے نیند بہتر ہوتی ہے۔\n' +
        '2. **کیفین سے بچیں**: شام کو چائے اور کافی نہ پئیں، جس سے نیند بہتر ہوتی ہے۔\n' +
        '3. **اسکرین بند کریں**: سونے سے ایک گھنٹہ پہلے فون بند کریں، جس سے نیند بہتر ہوتی ہے۔',
    ],
    [
      'English',
      '1. **Keep a schedule**: go to bed at the same time every night, which helps you sleep better.\n' +
        '2. **Skip caffeine**: avoid coffee and tea in the evening, which helps you sleep better.\n' +
        '3. **Dim the screens**: put the phone away an hour before bed, which helps you sleep better.',
    ],
  ])('keeps a %s list whose items all end in it', (_language, text) => {
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });
});

describe('markdown tables', () => {
  it('keeps a row that gives every column the same value', () => {
    const text =
      '| Feature | iPhone | Pixel | Galaxy |\n' +
      '| --- | --- | --- | --- |\n' +
      '| Wireless charging | Yes, built in | Yes, built in | Yes, built in |\n' +
      '| Headphone jack | No | No | No |';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('still cuts a phrase looping inside one cell', () => {
    const text =
      '| Body | Note |\n' +
      '| --- | --- |\n' +
      '| Sun | really hot really hot really hot really hot |';
    expect(truncateAtRepeatedClause(text)).toBe(
      '| Body | Note |\n| --- | --- |\n| Sun | really hot'
    );
  });
});

describe('sentence marks outside the Latin script', () => {
  it('cuts a Chinese sentence repeated after its full stop', () => {
    const sentence = '我每天早上都会去公园散步一个小时。';
    const text = `北京的天气很好。${sentence.repeat(4)}`;
    expect(truncateAtRepeatedClause(text)).toBe(`北京的天气很好。${sentence}`);
  });

  it.each([
    [
      'Chinese',
      '北京是中国的首都，有三千多年的历史。故宫、长城和天坛都是著名的景点。春天和秋天是最适合旅游的季节，天气温和。',
    ],
    [
      'Hindi',
      'पत्तियों का रंग शरद ऋतु में बदलता है। दिन छोटे होने पर पेड़ क्लोरोफिल बनाना बंद कर देते हैं। तब पीले और लाल रंग दिखाई देने लगते हैं।',
    ],
    [
      'Urdu',
      'زمین سورج کے گرد کشش ثقل کی وجہ سے گھومتی ہے۔ سورج کی کشش زمین کو اپنے مدار میں رکھتی ہے۔ ایک چکر تقریباً 365 دن میں پورا ہوتا ہے۔',
    ],
  ])('leaves loop-free %s prose alone', (_language, text) => {
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });
});

describe('one-letter words', () => {
  it('cuts one repeated eight times in a row', () => {
    expect(truncateAtRepeatedClause('उत्तर द द द द द द द द')).toBe('उत्तर द');
  });

  it('leaves one repeated a few times alone', () => {
    const text = 'Ha ha ha ha, to było zabawne.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('leaves a run of the same digit alone', () => {
    const text = 'Macierz zerowa: 0 0 0 0 0 0 0 0 0 0.';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });
});

describe('hasRunawayLoop', () => {
  const sentence = 'Sunlight scatters off the molecules in the air. ';

  it('waits until the loop has run on for two more copies', () => {
    expect(hasRunawayLoop(`Lead. ${sentence.repeat(2)}`)).toBe(false);
    expect(hasRunawayLoop(`Lead. ${sentence.repeat(3)}`)).toBe(true);
  });

  it('never fires on text the guard would not cut', () => {
    const text =
      'Leaves turn yellow when chlorophyll breaks down. ' +
      'Red comes from anthocyanins made in autumn. ' +
      'Brown is what is left when both are gone.';
    expect(hasRunawayLoop(text)).toBe(false);
  });

  it('still sees a glued loop at the end of a long answer', () => {
    const prose = Array.from(
      { length: 80 },
      (_, i) => `Point ${i + 1} adds something new.`
    ).join(' ');
    expect(prose.length).toBeGreaterThan(2048);
    expect(truncateAtRepeatedClause(prose)).toBe(prose);
    expect(hasRunawayLoop(`${prose} हे${'करा'.repeat(10)}`)).toBe(false);
    expect(hasRunawayLoop(`${prose} हे${'करा'.repeat(40)}`)).toBe(true);
  });
});

describe('a short unit repeated with no space between its copies', () => {
  it.each([
    [
      'Devanagari',
      `सोने से पहले हेकरा${'करा'.repeat(30)}`,
      'सोने से पहले हेकरा',
    ],
    ['Chinese', `答案是${'我们'.repeat(20)}`, '答案是我们'],
    ['Thai', `สวัสดี${'ครับ'.repeat(12)}`, 'สวัสดีครับ'],
    ['Latin', `Okay ${'ha'.repeat(40)}`, 'Okay ha'],
  ])('cuts a %s loop after its first copy', (_script, text, kept) => {
    expect(truncateAtRepeatedClause(text)).toBe(kept);
  });

  it('cuts a two-word loop whose words are too short for the phrase check', () => {
    const text = `1. नींद नाता दूर ${'न तू '.repeat(30)}`;
    expect(truncateAtRepeatedClause(text)).toBe('1. नींद नाता दूर न तू');
  });

  it('ends the cut where the next copy starts a sentence', () => {
    const text = `زمین چھوٹا ہے، ${'یہ چھوٹا ہے یا گھٹا ہے؟ '.repeat(6)}`;
    expect(truncateAtRepeatedClause(text)).toBe(
      'زمین چھوٹا ہے، یہ چھوٹا ہے یا گھٹا ہے؟'
    );
  });

  it('counts a consonant and its vowel sign as one letter', () => {
    const text = `नमस्ते ${'कि'.repeat(40)}`;
    expect(truncateAtRepeatedClause(text)).toBe(text);
    expect(truncateAtRepeatedClause(`नमस्ते ${'किता'.repeat(20)}`)).toBe(
      'नमस्ते किता'
    );
  });

  it.each([
    ['two letters', 'ha', 16],
    ['one letter', 'x', 64],
    ['a symbol', '-', 256],
  ])('waits until %s has filled its run', (_unit, unit, copies) => {
    const short = `Notes: ${unit.repeat(copies - 1)}`;
    expect(truncateAtRepeatedClause(short)).toBe(short);
    expect(truncateAtRepeatedClause(`Notes: ${unit.repeat(copies)}`)).toBe(
      `Notes: ${unit}`
    );
  });

  it.each([
    'ॐॐॐ शान्तिः शान्तिः शान्तिः',
    'Wow!!!!!!!!!!!! That is great.',
    `Loading${'.'.repeat(40)} done`,
    `Intro\n\n${'-'.repeat(80)}\n\nOutro`,
    `Title\n${'='.repeat(80)}\nBody text.`,
    `| ${'Col | '.repeat(12)}\n${'|---'.repeat(12)}|\n| ${'Yes | '.repeat(12)}`,
    `|${'Yes|'.repeat(12)}`,
    '🎉🎉🎉🎉🎉🎉 Congratulations! 👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧',
    'Card: 1111111111111111',
    `Binary: ${'10'.repeat(30)}`,
    'hahahahaha, that was funny',
    '哈哈哈哈哈哈，太好笑了。',
    'ｗｗｗｗｗｗｗｗｗｗ',
    '555555 ตลกมาก',
    `OPENAI_API_KEY=sk-${'x'.repeat(48)}`,
    'Gooooooooooooooooooal!',
    '高高兴兴地回家。研究研究再说。',
    'धीरे-धीरे चलो, बार-बार अभ्यास करो।',
    'どんどん良くなる。いろいろありがとう。',
  ])('leaves %s alone', (text) => {
    expect(truncateAtRepeatedClause(text)).toBe(text);
    expect(hasRunawayLoop(text)).toBe(false);
  });
});
