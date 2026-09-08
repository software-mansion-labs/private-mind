import { unnamedSubjects } from '../utils/web/subjectNaming';

describe('unnamedSubjects', () => {
  it('names a subject none of the pages mention', () => {
    expect(
      unnamedSubjects(
        'What are the opening hours of the Museum of Imaginary Instruments in Krakow',
        'Hours and ticketing - Museum of Illusions Krakow. Opening hours: Monday-Friday 10 AM-7 PM.'
      )
    ).toEqual(['Imaginary Instruments']);
  });

  it('stays quiet when even one word of the name appears', () => {
    expect(
      unnamedSubjects(
        'What are the opening hours of the Museum of Imaginary Instruments in Krakow',
        'The Museum of Musical Instruments in Krakow opens at 10 AM.'
      )
    ).toEqual([]);
  });

  it('stays quiet on a language that capitalises every noun', () => {
    const german = 'Wie sind die Oeffnungszeiten vom Deutschen Museum Muenchen';
    expect(
      unnamedSubjects(
        german,
        'Deutsches Museum, Muenchen — geoeffnet taeglich von 9 bis 17 Uhr.'
      )
    ).toEqual([]);
    expect(
      unnamedSubjects(german, 'Museum der Stadt, taeglich von 9 bis 17 Uhr.')
    ).toEqual([]);
  });

  it('needs more than one capitalised word to call a subject missing', () => {
    expect(
      unnamedSubjects(
        'What are the opening hours of the Rijksmuseum',
        'Opening hours of a different gallery entirely.'
      )
    ).toEqual([]);
  });

  it('ignores a capitalised word that only opens the question', () => {
    expect(
      unnamedSubjects('Krakow Poland weather', 'Nothing relevant here at all.')
    ).toEqual([]);
  });
});
