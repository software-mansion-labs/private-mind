import { isVersionAtLeast } from '../utils/appVersion';

describe('isVersionAtLeast', () => {
  it.each([
    ['1.3.5', '1.3.5', true],
    ['1.3.6', '1.3.5', true],
    ['1.4.0', '1.3.5', true],
    ['2.0', '1.3.5', true],
    ['1.3.4', '1.3.5', false],
    ['1.3', '1.3.5', false],
    ['1.10.0', '1.9.0', true],
  ])('%s at least %s is %s', (version, minimum, expected) => {
    expect(isVersionAtLeast(version, minimum)).toBe(expected);
  });
});
