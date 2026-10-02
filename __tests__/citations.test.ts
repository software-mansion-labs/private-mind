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

  it('keeps the indentation of a nested list in an answer with sources', () => {
    const answer =
      '1. Main point [1]\n   - detail one\n   - detail two [2]\n2. Next point';
    expect(stripCitations(answer)).toBe(
      '1. Main point\n   - detail one\n   - detail two\n2. Next point'
    );
  });

  it('keeps code indentation and spacing that has nothing to do with a citation', () => {
    const answer =
      'Use this [1]:\n```python\ndef total(xs):\n    return sum(xs)  # adds up\n```';
    expect(stripCitations(answer)).toBe(
      'Use this:\n```python\ndef total(xs):\n    return sum(xs)  # adds up\n```'
    );
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
