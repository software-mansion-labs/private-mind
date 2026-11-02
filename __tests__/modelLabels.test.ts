import {
  isCapabilityLabel,
  labelColor,
  labelIcon,
} from '../constants/model-labels';

describe('labelColor', () => {
  it.each([
    ['Thinking', 'gold'],
    ['Vision', 'sky'],
    ['Fast', 'orange'],
    ['Powerful', 'red'],
    ['Small', 'lime'],
    ['Great first model', 'green'],
    ['Balanced', 'mint'],
    ['Capable', 'cyan'],
    ['Smart', 'blue'],
    ['Reasoning', 'violet'],
    ['Good at coding', 'lilac'],
    ['Polish', 'pink'],
  ])('gives %s its own color', (label, color) => {
    expect(labelColor(label)).toBe(color);
  });

  it('gives every known label a different color', () => {
    const known = [
      'Thinking',
      'Vision',
      'Fast',
      'Powerful',
      'Small',
      'Great first model',
      'Balanced',
      'Capable',
      'Smart',
      'Reasoning',
      'Good at coding',
      'Polish',
    ];
    expect(new Set(known.map(labelColor)).size).toBe(known.length);
  });

  it('ignores case and stray spaces', () => {
    expect(labelColor('  good   AT coding ')).toBe('lilac');
  });

  it('colors a label the catalog adds later with the fallback', () => {
    expect(labelColor('Multilingual')).toBe('periwinkle');
  });

  it('does not mistake object built-ins for labels', () => {
    expect(labelColor('constructor')).toBe('periwinkle');
  });
});

describe('labelIcon', () => {
  it.each(['Thinking', 'Vision', 'Fast'])('gives %s an icon', (label) => {
    expect(labelIcon(label)).toBeDefined();
  });

  it('leaves other labels without an icon', () => {
    expect(labelIcon('Balanced')).toBeUndefined();
  });
});

describe('isCapabilityLabel', () => {
  it.each(['Thinking', 'vision'])('treats %s as a capability', (label) => {
    expect(isCapabilityLabel(label)).toBe(true);
  });

  it('keeps Reasoning as a regular label', () => {
    expect(isCapabilityLabel('Reasoning')).toBe(false);
  });
});
