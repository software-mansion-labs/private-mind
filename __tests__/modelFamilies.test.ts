import { familyIcon, familyInitial } from '../constants/model-families';

describe('familyIcon', () => {
  it.each(['Gemma 4', 'Qwen 3', 'Qwen 2.5', 'LLaMA 3.2', 'LFM 2.5'])(
    'has an icon for %s',
    (family) => {
      expect(familyIcon(family)).toBeDefined();
    }
  );

  it('recognises a later generation of a known family', () => {
    expect(familyIcon('Qwen 4')).toBeDefined();
  });

  it('ignores case and leading spaces', () => {
    expect(familyIcon('  llama 4')).toBeDefined();
  });

  it.each(['Bielik', 'Phi 4', ''])('has no icon for %p', (family) => {
    expect(familyIcon(family)).toBeUndefined();
  });
});

describe('familyInitial', () => {
  it('takes the first letter of the family name, uppercased', () => {
    expect(familyInitial('bielik')).toBe('B');
  });

  it('skips leading spaces', () => {
    expect(familyInitial('  Phi 4')).toBe('P');
  });

  it('keeps a character outside the basic alphabet whole', () => {
    expect(familyInitial('Łoś')).toBe('Ł');
  });

  it('returns nothing for an empty name', () => {
    expect(familyInitial('   ')).toBe('');
  });
});
