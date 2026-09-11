import { mapOutsideThink } from '../utils/thinking';

describe('mapOutsideThink', () => {
  const upper = (segment: string) => segment.toUpperCase();

  it('transforms the visible text and leaves the think block untouched', () => {
    expect(mapOutsideThink('a<think>keep me</think>b', upper)).toBe(
      'A<think>keep me</think>B'
    );
  });

  it('keeps an unterminated think block verbatim', () => {
    expect(mapOutsideThink('a<think>still going', upper)).toBe(
      'A<think>still going'
    );
  });

  it('treats a bare closing marker as the end of an opening block', () => {
    expect(mapOutsideThink('thoughts</think>answer', upper)).toBe(
      '<think>thoughts</think>ANSWER'
    );
  });

  it('is the identity for text without markers', () => {
    expect(mapOutsideThink('plain', (segment) => segment)).toBe('plain');
  });
});
