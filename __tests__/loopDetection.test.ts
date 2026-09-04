import { truncateAtRepeatedClause } from '../utils/loopDetection';

describe('truncateAtRepeatedClause', () => {
  it('cuts the answer where a clause starts repeating back-to-back', () => {
    const text =
      'Najważniejsze wydarzenia na świecie w tym tygodniu obejmują: ' +
      'wzrost wzajemnych wymagań w Wietnie, zwiększenie opadów deszczów w Wyspach, ' +
      'wypadek w Szwecji, wypadek w Szwecji, a także wypadek w Szwecji.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('wypadek w Szwecji, wypadek w Szwecji');
    expect(result.endsWith('opadów deszczów w Wyspach,')).toBe(true);
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
    expect(result).toBe('Podsumowanie:');
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
    expect(result).toBe('Dokonał wielu reform, w tym:');
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
    expect(result.endsWith('W tym zakresie:')).toBe(true);
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
    expect(result.endsWith('devlet merkezleri,')).toBe(true);
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
    expect(result.endsWith('w formie')).toBe(true);
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
    expect(result.endsWith('Odpowiedź brzmi:')).toBe(true);
  });

  it('cuts a three-word phrase looping with no punctuation between copies', () => {
    const text =
      'Wynik to: na pewno tak na pewno tak na pewno tak na pewno tak.';
    const result = truncateAtRepeatedClause(text);
    expect(result).not.toContain('na pewno tak na pewno tak');
    expect(result.endsWith('Wynik to:')).toBe(true);
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
