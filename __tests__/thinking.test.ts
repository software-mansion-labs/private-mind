import {
  mapOutsideThink,
  unclosedThinkAsAnswer,
  withTemplateThinkOpener,
  dropStrayThinkClose,
  hasUnclosedThink,
} from '../utils/thinking';

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

describe('withTemplateThinkOpener', () => {
  it('opens the block the chat template already opened in the prompt', () => {
    expect(withTemplateThinkOpener('\nreasoning</think>answer')).toBe(
      '<think>\nreasoning</think>answer'
    );
  });

  it('leaves text that opens its own block alone', () => {
    expect(withTemplateThinkOpener('<think>x</think>y')).toBe(
      '<think>x</think>y'
    );
  });
});

describe('dropStrayThinkClose', () => {
  it('drops a close tag that no open tag precedes', () => {
    expect(dropStrayThinkClose('Polish answer</think>English tail')).toBe(
      'Polish answerEnglish tail'
    );
  });

  it('keeps a close tag that closes an open block', () => {
    expect(dropStrayThinkClose('<think>why</think>answer')).toBe(
      '<think>why</think>answer'
    );
  });

  it('keeps a close tag when the block was opened in an earlier chunk', () => {
    expect(dropStrayThinkClose('more</think>answer', true)).toBe(
      'more</think>answer'
    );
  });

  it('drops a second close tag after the block is closed', () => {
    expect(dropStrayThinkClose('<think>a</think>b</think>c')).toBe(
      '<think>a</think>bc'
    );
  });
});

describe('hasUnclosedThink', () => {
  it('is true only while an open tag has no close', () => {
    expect(hasUnclosedThink('<think>so far')).toBe(true);
    expect(hasUnclosedThink('<think>done</think>answer')).toBe(false);
    expect(hasUnclosedThink('plain')).toBe(false);
  });
});
