import {
  familyIcon,
  familyIconScale,
  familyInitial,
} from '../constants/model-families';

describe('familyIcon', () => {
  it.each(['Gemma 4', 'Qwen 3', 'Qwen 2.5', 'LLaMA 3.2', 'LFM 2.5', 'Bielik'])(
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

  it.each(['Mistral', 'Phi 4', ''])('has no icon for %p', (family) => {
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

describe('familyIconScale', () => {
  it('draws the Liquid and Qwen marks smaller, since they fill more of their box than Gemma or Meta', () => {
    expect(familyIconScale('LFM 3')).toBeLessThan(familyIconScale('Qwen 3'));
    expect(familyIconScale('Qwen 3')).toBeLessThan(familyIconScale('Gemma 4'));
    expect(familyIconScale('LLaMA 3.2')).toBe(1);
  });

  it('leaves a family without an icon at full size', () => {
    expect(familyIconScale('Phi 4')).toBe(1);
  });
});
