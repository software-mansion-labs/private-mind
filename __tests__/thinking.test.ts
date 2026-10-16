import { mapOutsideThink, unclosedThinkAsAnswer } from '../utils/thinking';

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

describe('a think block the model opened and never closed, with thinking off', () => {
  const answer =
    '**Photosynthesis**\n\nPlants turn light into chemical energy.';

  it('becomes the answer', () => {
    expect(unclosedThinkAsAnswer(`<think>\n\n${answer}`)).toBe(answer);
  });

  it('leaves a closed think block and its answer alone', () => {
    const closed = `<think>\n\n</think>\n\n${answer}`;
    expect(unclosedThinkAsAnswer(closed)).toBe(closed);
  });

  it('leaves an answer without a think block alone', () => {
    expect(unclosedThinkAsAnswer(answer)).toBe(answer);
  });
});
