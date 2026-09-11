import { dominantScript, isForeignScript } from '../utils/web/resultScript';

describe('dominantScript', () => {
  it('reads the script a title is actually written in', () => {
    expect(dominantScript('Samsung Galaxy S25 - Media Expert')).toBe('latin');
    expect(dominantScript('سعر سامسونج جالاكسي إس 25')).toBe('arabic');
    expect(dominantScript('Цена смартфона в России сегодня')).toBe('cyrillic');
    expect(dominantScript('三星 Galaxy S25 价格 多少钱 现在')).toBe('cjk');
  });

  it('ignores digits, punctuation and emoji when deciding', () => {
    expect(dominantScript('Galaxy S25 — 3 999,00 zł (2025)')).toBe('latin');
  });

  it('gives no verdict on something too short to judge', () => {
    expect(dominantScript('S25')).toBeNull();
    expect(dominantScript('4 999 zł')).toBeNull();
    expect(dominantScript('')).toBeNull();
  });
});

describe('isForeignScript', () => {
  const polish = 'Ile kosztuje Samsung Galaxy S25 w Polsce?';

  it('flags a result written in another script than the question', () => {
    expect(isForeignScript('سعر سامسونج جالاكسي إس 25 في مصر', polish)).toBe(
      true
    );
    expect(isForeignScript('Цена смартфона в России сегодня', polish)).toBe(
      true
    );
  });

  it('keeps a mixed title whose Latin brand name still dominates', () => {
    expect(isForeignScript('Цена Samsung Galaxy S25 в России', polish)).toBe(
      false
    );
  });

  it('keeps another language in the same script — an English page answers a Polish question', () => {
    expect(isForeignScript('Samsung Galaxy S25 price and specs', polish)).toBe(
      false
    );
    expect(
      isForeignScript('Samsung Galaxy S25 Preis und Verfügbarkeit', polish)
    ).toBe(false);
  });

  it('says nothing when either side is too short to judge', () => {
    expect(isForeignScript('سعر', polish)).toBe(false);
    expect(isForeignScript('Samsung Galaxy S25 price', 'S25?')).toBe(false);
  });

  it('works the other way round for a question in a non-Latin script', () => {
    const arabic = 'كم يبلغ سعر سامسونج جالاكسي إس 25؟';
    expect(isForeignScript('Samsung Galaxy S25 - Media Expert', arabic)).toBe(
      true
    );
    expect(isForeignScript('سعر سامسونج جالاكسي إس 25 اليوم', arabic)).toBe(
      false
    );
  });
});
