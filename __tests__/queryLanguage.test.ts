import { sharesLanguageWith } from '../utils/web/queryLanguage';

const OLED_CONVERSATION = [
  'User: jaki jest najlepszy tv OLED?',
  'Assistant: Model LG OLED65B65LA znalazł się w zestawieniu najlepszych telewizorów OLED 2026.',
  'User: Ile kosztuje?',
  'Assistant: Cena telewizora LG OLED65B65LA wynosi 6999.00 PLN.',
  'User: wypisz jakie ma funkcje i parametry techniczne oraz powiedz czy sprawdzi się w salonie z dużymi oknami',
].join('\n');

describe('sharesLanguageWith', () => {
  it('flags the English queries the planner wrote for a Polish question (live #341)', () => {
    for (const drifted of [
      'best TV for large living room features',
      'TV technical specifications',
      'TV suitability for large windows',
    ]) {
      expect(sharesLanguageWith(drifted, OLED_CONVERSATION)).toBe(false);
    }
  });

  it('throws out a short English query that carries no code from a Polish conversation (smoke T5)', () => {
    expect(sharesLanguageWith('cost of OLED TV', OLED_CONVERSATION)).toBe(
      false
    );
  });

  it('keeps a short query in the language of the conversation', () => {
    expect(
      sharesLanguageWith(
        'cost of the TV',
        'User: which OLED TV is best?\nAssistant: The LG OLED65B65LA tops the list.\nUser: How much is it?'
      )
    ).toBe(true);
  });

  it('lets a two-word query through when the one word it shares is international (live #361)', () => {
    expect(
      sharesLanguageWith('Samsung QE65S99H vs other models', OLED_CONVERSATION)
    ).toBe(true);
  });

  it('does not read a Title Case query as one long name', () => {
    expect(
      sharesLanguageWith(
        'Best TV For Large Living Room Features',
        OLED_CONVERSATION
      )
    ).toBe(false);
  });

  it('does not hold a product the planner introduced against the query', () => {
    expect(
      sharesLanguageWith(
        'Sony Bravia 8 II parametry techniczne',
        OLED_CONVERSATION
      )
    ).toBe(true);
  });

  it('does not take a cognate for a shared word (technical / techniczne)', () => {
    expect(
      sharesLanguageWith('Samsung QE65S99H model comparison', OLED_CONVERSATION)
    ).toBe(true);
    expect(
      sharesLanguageWith('TV technical specifications', OLED_CONVERSATION)
    ).toBe(false);
  });

  it('accepts a query that shares an inflected word with the conversation', () => {
    expect(
      sharesLanguageWith(
        'parametry techniczne telewizora LG OLED65B65LA',
        OLED_CONVERSATION
      )
    ).toBe(true);
  });

  it('cannot judge a query that is one word beside an entity, and lets it through', () => {
    expect(sharesLanguageWith('cena LG OLED65B65LA', OLED_CONVERSATION)).toBe(
      true
    );
    expect(
      sharesLanguageWith('Samsung QE65S99H benefits', OLED_CONVERSATION)
    ).toBe(true);
  });

  it('accepts an English query when the user wrote in English', () => {
    expect(
      sharesLanguageWith(
        'best OLED TV for bright living room 2026',
        'User: what is the best OLED TV for a bright living room?'
      )
    ).toBe(true);
  });

  it('flags a Latin-script query written for a question in another script', () => {
    expect(
      sharesLanguageWith(
        'Delhi weather forecast today',
        'User: दिल्ली में आज का मौसम कैसा है'
      )
    ).toBe(false);
    expect(
      sharesLanguageWith(
        'दिल्ली मौसम आज',
        'User: दिल्ली में आज का मौसम कैसा है'
      )
    ).toBe(true);
  });

  it('does not count a number or a model token as language evidence', () => {
    expect(
      sharesLanguageWith('QE65S99H 2026 review', 'User: ile kosztuje QE65S99H?')
    ).toBe(true);
  });
});
