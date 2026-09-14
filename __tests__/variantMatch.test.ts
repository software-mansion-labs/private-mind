import {
  addsUnaskedVariant,
  demoteUnaskedVariants,
  variantTokensIn,
} from '../utils/web/variantMatch';
import type { WebSearchResult } from '../utils/web/types';

const page = (title: string): WebSearchResult => ({
  title,
  url: `https://x.example/${encodeURIComponent(title)}`,
  snippet: '',
});

describe('variantTokensIn', () => {
  it('reads the variant words that separate one model from another', () => {
    expect(variantTokensIn('Samsung Galaxy S25 Plus dane techniczne')).toEqual([
      'plus',
    ]);
    expect(variantTokensIn('iPhone 17 Pro Max')).toEqual(['pro', 'max']);
    expect(variantTokensIn('Samsung Galaxy S25')).toEqual([]);
  });

  it('does not read a variant word out of the middle of another word', () => {
    expect(variantTokensIn('Proszek do prania')).toEqual([]);
    expect(variantTokensIn('Airbnb w Krakowie')).toEqual([]);
  });
});

describe('addsUnaskedVariant', () => {
  const query = 'Ile kosztuje Samsung Galaxy S25';

  it('flags a page for a variant the question never mentioned (live-found)', () => {
    expect(
      addsUnaskedVariant('Samsung Galaxy S25 Plus dane techniczne', query)
    ).toBe(true);
    expect(addsUnaskedVariant('Samsung Galaxy S25 Ultra recenzja', query)).toBe(
      true
    );
  });

  it('leaves the page for the model that was asked about', () => {
    expect(
      addsUnaskedVariant('Samsung Galaxy S25 dane techniczne', query)
    ).toBe(false);
  });

  it('keeps the variant page when the question asked for that variant', () => {
    expect(
      addsUnaskedVariant(
        'Samsung Galaxy S25 Ultra dane techniczne',
        'Ile kosztuje Samsung Galaxy S25 Ultra'
      )
    ).toBe(false);
  });
});

describe('demoteUnaskedVariants', () => {
  it('puts the asked-for model ahead of its bigger siblings (live-found: S25 answered with S25+ specs)', () => {
    const ranked = demoteUnaskedVariants(
      [
        page('Samsung Galaxy S25 Plus dane techniczne - Telepolis.pl'),
        page('Samsung Galaxy S25 dane techniczne - Telepolis.pl'),
        page('Samsung Galaxy S25 Ultra recenzja'),
      ],
      'Ile ma pamieci RAM Samsung Galaxy S25'
    );
    expect(ranked[0]!.title).toContain('S25 dane techniczne');
  });

  it('changes nothing when every result is on-model, or none is', () => {
    const onModel = [page('Galaxy S25 A'), page('Galaxy S25 B')];
    expect(demoteUnaskedVariants(onModel, 'Galaxy S25')).toBe(onModel);
    const allVariants = [page('Galaxy S25 Plus'), page('Galaxy S25 Ultra')];
    expect(demoteUnaskedVariants(allVariants, 'Galaxy S25')).toBe(allVariants);
  });

  it('keeps the order stable among equals', () => {
    const ranked = demoteUnaskedVariants(
      [page('S25 Plus'), page('S25 first'), page('S25 second')],
      'Galaxy S25'
    );
    expect(ranked.map((r) => r.title)).toEqual([
      'S25 first',
      'S25 second',
      'S25 Plus',
    ]);
  });
});
