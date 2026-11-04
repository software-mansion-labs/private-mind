import { formatGB, formatModelMeta, joinMeta } from '../utils/modelMeta';

describe('formatGB', () => {
  it('rounds to two decimals', () => {
    expect(formatGB(1.0712)).toBe('1.07 GB');
  });
});

describe('joinMeta', () => {
  it('drops empty parts', () => {
    expect(joinMeta(['Thinking', null, undefined, false, '1.07 GB'])).toBe(
      'Thinking · 1.07 GB'
    );
  });
});

describe('formatModelMeta', () => {
  it('prints size and parameters in the requested unit', () => {
    const model = { modelSize: 1.0712, parameters: 1.72 };
    expect(formatModelMeta(model, 'B')).toBe('1.07 GB · 1.72 B');
    expect(formatModelMeta(model, 'B params')).toBe('1.07 GB · 1.72 B params');
  });

  it('skips missing values', () => {
    expect(formatModelMeta({ modelSize: 0.74 }, 'B')).toBe('0.74 GB');
    expect(formatModelMeta({}, 'B')).toBe('');
  });
});
