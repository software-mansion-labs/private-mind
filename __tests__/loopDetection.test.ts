import {
  isRepetitionFromTheStart,
  truncateAtRepeatedClause,
} from '../utils/loopDetection';

describe('truncateAtRepeatedClause — the line that announced the repeat', () => {
  const item1 =
    '۱. **جغرافیہ:** پاکستان جنوبی ایشیا میں واقع ایک ایسا ملک ہے جو ایک خاص جغرافیائی اہمیت رکھتا ہے۔';
  const item2 =
    '۲. **تاریخ:** پاکستان کا قیام ایک علیحدہ مسلم ریاست کے طور پر ہوا اور اس کی تاریخ بہت اہم ہے۔';
  const item3 =
    '۳. **ثقافت:** پاکستان ایک ایسا ملک ہے جہاں مختلف لسانی اور ثقافتی گروہ ایک ساتھ رہتے ہیں۔';
  const list = [item1, item2, item3].join('\n\n');

  it('drops a heading that only introduced the list the model started to repeat (iPhone, Urdu)', () => {
    const looped = `پاکستان کے بارے میں تین اہم باتیں یہ ہیں:\n\n${list}\n\n---\n\n**اردو میں مکمل جواب:**\n\n${list}`;

    const kept = truncateAtRepeatedClause(looped);

    expect(kept.endsWith(item3)).toBe(true);
    expect(kept).not.toContain('مکمل جواب');
    expect(kept).not.toContain('---');
  });

  it('keeps a line that only mentions a colon in passing', () => {
    expect(
      truncateAtRepeatedClause(
        'Time: 10:30 is when it starts and it is fine. Time: 10:30 is when it starts and it is fine. Time: 10:30 is when it starts and it is fine.'
      )
    ).toContain('Time: 10:30');
  });
});

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

  it('keeps a list whose items share one identical line, instead of erasing the items already on screen (I-71)', () => {
    const text =
      'भारत के प्रमुख त्योहार:\n' +
      '1. **दिवाली**\n' +
      '- **महत्व:** यह बुराई पर अच्छाई की जीत का प्रतीक है।\n' +
      '- **अवधि:** यह कार्तिक अमावस्या को मनाया जाता है।\n' +
      '2. **होली**\n' +
      '- **महत्व:** यह वसंत के आगमन का उत्सव है।\n' +
      '- **अवधि:** यह फाल्गुन पूर्णिमा को मनाया जाता है।\n' +
      '3. **दशहरा**\n' +
      '- **महत्व:** यह बुराई पर अच्छाई की जीत का प्रतीक है।\n' +
      '- **अवधि:** यह आश्विन शुक्ल दशमी को मनाया जाता है।\n' +
      '4. **दुर्गा पूजा**\n' +
      '- **महत्व:** यह देवी दुर्गा की शक्ति की आराधना है।';
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('keeps a structured list whose items repeat the same section labels (I-80)', () => {
    const festival = (n: number, name: string, when: string) =>
      `${n}. **${name}**\n**महत्व:**\nयह ${name} का महत्वपूर्ण पर्व है।\n**समय:**\n${when}\n**परंपराएं:**\nलोग ${name} पर विशेष पूजा करते हैं।\n`;
    const text =
      'भारत के प्रमुख त्योहार:\n' +
      festival(1, 'दिवाली', 'यह अक्टूबर या नवंबर में आता है।') +
      festival(2, 'होली', 'यह मार्च के अंत में आता है।') +
      festival(3, 'दशहरा', 'यह सितंबर या अक्टूबर में आता है।') +
      festival(4, 'ईद', 'यह चंद्र कैलेंडर के अनुसार आती है।');
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('keeps an English answer that gives every item the same headings', () => {
    const festival = (name: string) =>
      `### ${name}\n**Significance:**\n${name} marks a major moment in the year.\n**Traditions:**\nPeople celebrate ${name} with food and music.\n`;
    const text = festival('Diwali') + festival('Holi') + festival('Eid');
    expect(truncateAtRepeatedClause(text)).toBe(text);
  });

  it('still cuts items that repeat their content under the same labels', () => {
    const block =
      '**Traditions:**\nPeople celebrate with food, music and prayers at home.\n';
    const text = 'Festivals:\n' + block + block + block;
    const result = truncateAtRepeatedClause(text);
    expect(
      result.match(/People celebrate with food, music and prayers at home\./g)
    ).toHaveLength(1);
  });

  it('still cuts a block of lines that comes back in the same order', () => {
    const text =
      'Lyrics:\n' +
      'Hey, how is it going today?\n' +
      'Are you drinking to pass the time?\n' +
      'Translation:\n' +
      'Hey, how is it going today?\n' +
      'Are you drinking to pass the time?';
    const result = truncateAtRepeatedClause(text);
    expect(result).toContain('Are you drinking to pass the time?');
    expect(result.match(/Hey, how is it going today\?/g)).toHaveLength(1);
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
