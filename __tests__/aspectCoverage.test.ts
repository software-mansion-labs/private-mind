import { aspectsMissingFromAnswer } from '../utils/messageSources';

const SUB_QUERIES = ['kurs bitcoin', 'kurs ethereum'];
const CONTEXT =
  'Kurs bitcoina wynosi dziś 98 000 USD i rośnie od tygodnia. ' +
  'Kurs ethereum wynosi dziś 3 200 USD i spada od wczoraj.';
const BITCOIN_ONLY =
  'Bitcoin kosztuje obecnie około 98 000 USD i od tygodnia zyskuje na wartości.';
const BOTH =
  'Bitcoin kosztuje około 98 000 USD, a ethereum około 3 200 USD; ' +
  'pierwszy rośnie, drugi spada.';

describe('an answer that skips an aspect the sources cover', () => {
  it('names the sub-query whose distinctive terms the answer never mentions', () => {
    expect(
      aspectsMissingFromAnswer(BITCOIN_ONLY, SUB_QUERIES, CONTEXT)
    ).toEqual(['kurs ethereum']);
  });

  it('is satisfied once every aspect is mentioned, in whatever inflection', () => {
    expect(aspectsMissingFromAnswer(BOTH, SUB_QUERIES, CONTEXT)).toEqual([]);
    expect(
      aspectsMissingFromAnswer(
        'Bitcoina wyceniano na 98 000 USD, ethereum na 3 200 USD.',
        SUB_QUERIES,
        CONTEXT
      )
    ).toEqual([]);
  });

  it('does not blame the answer for an aspect the sources never covered', () => {
    const bitcoinContext = 'Kurs bitcoina wynosi dziś 98 000 USD i rośnie.';
    expect(
      aspectsMissingFromAnswer(BITCOIN_ONLY, SUB_QUERIES, bitcoinContext)
    ).toEqual([]);
  });

  it('has nothing to say about a single-query search', () => {
    expect(
      aspectsMissingFromAnswer(BITCOIN_ONLY, ['kurs bitcoin'], CONTEXT)
    ).toEqual([]);
    expect(aspectsMissingFromAnswer(BITCOIN_ONLY, undefined, CONTEXT)).toEqual(
      []
    );
  });

  it('skips an aspect that has no term of its own to look for', () => {
    expect(
      aspectsMissingFromAnswer(
        'Będzie ciepło i słonecznie, około 20 stopni przez cały dzień.',
        ['pogoda Kraków', 'pogoda Kraków weekend'],
        'Pogoda Kraków: dziś 20 stopni, w weekend 18 stopni i deszcz.'
      )
    ).toEqual(['pogoda Kraków weekend']);
  });

  it('ignores the site: operator the planner appends to every query', () => {
    expect(
      aspectsMissingFromAnswer(
        BOTH,
        ['kurs bitcoin site:bankier.pl', 'kurs ethereum site:bankier.pl'],
        CONTEXT
      )
    ).toEqual([]);
  });

  it('leaves a short refusal to the other checks', () => {
    expect(aspectsMissingFromAnswer('Nie wiem.', SUB_QUERIES, CONTEXT)).toEqual(
      []
    );
  });

  it('reads only the visible part of the answer', () => {
    expect(
      aspectsMissingFromAnswer(
        `<think>ethereum też jest w źródłach</think>${BITCOIN_ONLY}`,
        SUB_QUERIES,
        CONTEXT
      )
    ).toEqual(['kurs ethereum']);
  });
});
