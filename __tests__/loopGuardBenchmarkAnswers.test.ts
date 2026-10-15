import benchmarkAnswers from './fixtures/benchmarkLoopAnswers.json';
import { normalizeModelText } from '../utils/normalizeModelText';
import { mapOutsideThink } from '../utils/thinking';
import { tidyVisibleAnswer } from '../utils/visibleAnswer';

type BenchmarkAnswer = {
  name: string;
  model: string;
  device: string;
  prompt: string;
  raw: string;
};

const answers = benchmarkAnswers as BenchmarkAnswer[];

const answerNamed = (name: string): BenchmarkAnswer => {
  const answer = answers.find((candidate) => candidate.name === name);
  if (!answer) throw new Error(`no benchmark answer named ${name}`);
  return answer;
};

const SENTENCE_END = /[.!?।॥۔؟。！？\n]/u;
const MIN_COUNTED_SENTENCE_CHARS = 10;

const mostRepeatedSentenceCount = (text: string): number => {
  const counts = new Map<string, number>();
  for (const part of text.split(SENTENCE_END)) {
    const sentence = part.trim().toLowerCase();
    if (sentence.length < MIN_COUNTED_SENTENCE_CHARS) continue;
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
};

const untouched = (raw: string): string =>
  mapOutsideThink(raw, normalizeModelText);

describe('benchmark answers the guard used to cut without a loop', () => {
  it('keeps a Polish list whose items end in the same clause after a comma', () => {
    const { raw } = answerNamed('polish-shared-sentence-tail');
    const tidied = tidyVisibleAnswer(raw);
    expect(tidied).toContain('3. **Anthonidyny**');
    expect(tidied).toBe(untouched(raw));
  });
});

describe('where a cut leaves a looping answer', () => {
  it('ends the looping Polish paragraph on a full sentence, not a comma', () => {
    const { raw } = answerNamed('polish-paragraph-loop');
    const tidied = tidyVisibleAnswer(raw);
    expect(tidied.length).toBeLessThan(raw.length / 4);
    expect(tidied.endsWith('.')).toBe(true);
    expect(mostRepeatedSentenceCount(tidied)).toBeLessThanOrEqual(2);
  });
});
