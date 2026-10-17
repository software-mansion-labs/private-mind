import { answerOpensNextTurn, tidyVisibleAnswer } from '../utils/visibleAnswer';

describe('an answer that runs on into the next chat turn (dev benchmark 15.10, Qwen 2.5 3B on S25)', () => {
  const table = [
    'Below is a markdown table comparing the Sun, the Moon and Earth:',
    '',
    '| Body | Diameter |',
    '|------|----------|',
    '| Moon | ~3,474 km |',
  ].join('\n');
  const leaked = `${table}\n<|im_start|>user\nMake a markdown table comparing the Sun, the`;

  it('shows only the reply, not the turn the model invented after it', () => {
    expect(tidyVisibleAnswer(leaked)).toBe(table);
  });

  it('stops the stream once the reply has ended', () => {
    expect(answerOpensNextTurn(leaked)).toBe(true);
    expect(answerOpensNextTurn(table)).toBe(false);
  });

  it.each([
    `${table}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\nAnd Mars?`,
    `${table}<end_of_turn>\n<start_of_turn>user\nAnd Mars?`,
  ])('knows the turn markers of the other model families: %j', (answer) => {
    expect(tidyVisibleAnswer(answer)).toBe(table);
  });

  it('keeps a reply that only starts with a marker', () => {
    expect(answerOpensNextTurn('<|im_start|>assistant\nHello!')).toBe(false);
    expect(tidyVisibleAnswer('<|im_start|>assistant\nHello!')).toContain(
      'Hello!'
    );
  });
});
