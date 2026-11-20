import {
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

describe('truncateAtRepeatedClause on answers with code', () => {
  const nestedLoop = [
    'Here is the screen:',
    '',
    '```jsx',
    'return (',
    '  <View style={styles.container}>',
    ...Array.from(
      { length: 12 },
      (_, depth) =>
        `${'  '.repeat(depth + 2)}<View style={styles.formInputContainer}>`
    ),
  ].join('\n');

  it('cuts a code block that keeps repeating one line, deeper each time (#525)', () => {
    const out = truncateAtRepeatedClause(nestedLoop);
    expect(out.split('formInputContainer').length - 1).toBe(1);
    expect(out).toContain('<View style={styles.container}>');
  });

  it('closes the code block it cuts, so the rest of the answer still renders', () => {
    const out = truncateAtRepeatedClause(nestedLoop);
    expect(out.endsWith('\n```')).toBe(true);
  });

  it('cuts a code block that keeps repeating the same group of lines', () => {
    const row = [
      '  <tr>',
      '    <td>France</td>',
      '    <td>Paris</td>',
      '    <td>12 million</td>',
      '  </tr>',
    ];
    const answer = [
      '```html',
      '<table>',
      '  <tr>',
      '    <td>Germany</td>',
      '    <td>Berlin</td>',
      '    <td>8.5 million</td>',
      '  </tr>',
      ...row,
      ...row,
      ...row,
      ...row,
    ].join('\n');
    const out = truncateAtRepeatedClause(answer);
    expect(out.split('<td>France</td>').length - 1).toBe(1);
    expect(out).toContain('<td>Germany</td>');
  });

  it('leaves a table whose rows share a shape but not their content alone', () => {
    const answer = [
      '```html',
      '<table>',
      ...['Berlin', 'Madrid', 'Rome', 'Paris'].flatMap((city) => [
        '  <tr>',
        `    <td>${city}</td>`,
        '    <td class="population">unknown</td>',
        '  </tr>',
      ]),
      '</table>',
      '```',
    ].join('\n');
    expect(truncateAtRepeatedClause(answer)).toBe(answer);
  });

  it('leaves code that repeats a line a few times on purpose alone', () => {
    const answer = [
      '```js',
      'const save = async () => {',
      '  setLoading(true);',
      '  try {',
      '    await api.save(form);',
      '  } finally {',
      '    setLoading(false);',
      '  }',
      '};',
      '',
      'const remove = async () => {',
      '  setLoading(true);',
      '  try {',
      '    await api.remove(form.id);',
      '  } finally {',
      '    setLoading(false);',
      '  }',
      '};',
      '```',
      '',
      'Both handlers clear the spinner when they finish.',
    ].join('\n');
    expect(truncateAtRepeatedClause(answer)).toBe(answer);
  });

  it('leaves a JSX tree with repeated closing tags and sibling rows alone', () => {
    const answer = [
      '```jsx',
      '<View style={styles.form}>',
      '  <TextInput style={styles.input} placeholder="Email" />',
      '  <TextInput style={styles.input} placeholder="Password" />',
      '  <View style={styles.row}>',
      '    <Text style={styles.label}>Remember me</Text>',
      '  </View>',
      '  <View style={styles.row}>',
      '    <Text style={styles.label}>Forgot password?</Text>',
      '  </View>',
      '</View>',
      '```',
    ].join('\n');
    expect(truncateAtRepeatedClause(answer)).toBe(answer);
  });

  it('does not split a clause on the dots inside inline code', () => {
    const answer = [
      'How the styles work:',
      '- The `styles.container` style centers the welcome message and the button.',
      '- The `styles.welcomeText` style sets the font size, weight and alignment.',
      '- The `styles.buttonContainer` style sets the margin and padding for the button.',
      '',
      'Run the app with `npx expo start`.',
    ].join('\n');
    expect(truncateAtRepeatedClause(answer)).toBe(answer);
  });

  it('still catches prose that loops after a code block', () => {
    const sentence = 'Make sure the server is running before you test the app.';
    const answer = [
      '```js',
      'fetch(url);',
      '```',
      sentence,
      sentence,
      sentence,
    ].join('\n');
    const out = truncateAtRepeatedClause(answer);
    expect(out.split('server is running').length - 1).toBe(1);
  });
});
