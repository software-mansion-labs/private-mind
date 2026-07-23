import { stripCitations } from '../utils/citations';

describe('stripCitations', () => {
  it('removes a single citation marker and tidies punctuation spacing', () => {
    expect(stripCitations('The total was 100 [1].')).toBe('The total was 100.');
  });

  it('removes grouped citation markers', () => {
    expect(stripCitations('Backed by [1][3] as noted.')).toBe(
      'Backed by as noted.'
    );
  });

  it('collapses doubled spaces left behind mid-sentence', () => {
    expect(stripCitations('See [2] the report.')).toBe('See the report.');
  });

  it('leaves text without citations untouched', () => {
    expect(stripCitations('No markers here.')).toBe('No markers here.');
  });

  it('does not strip long bracketed numbers (e.g. array indices)', () => {
    expect(stripCitations('arr[1234] value')).toBe('arr[1234] value');
  });

  it('returns empty/falsy text unchanged', () => {
    expect(stripCitations('')).toBe('');
  });
});
