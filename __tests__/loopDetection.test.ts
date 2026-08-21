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
