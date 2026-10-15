import benchmarkAnswers from './fixtures/benchmarkLoopAnswers.json';
import { normalizeModelText } from '../utils/normalizeModelText';
import { mapOutsideThink } from '../utils/thinking';
import {
  answerRunsAwayInLoop,
  tidyVisibleAnswer,
} from '../utils/visibleAnswer';

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

const STREAM_CHUNK_CHARS = 3;
const RUNAWAY_TAIL_CHARS = 64;

const stopPointWhileStreaming = (raw: string): number | null => {
  for (let end = STREAM_CHUNK_CHARS; end < raw.length; end += 1) {
    if (answerRunsAwayInLoop(raw.slice(0, end))) return end;
  }
  return null;
};

describe('benchmark answers that looped in Hindi and Urdu (UW-58)', () => {
  it.each([
    ['hindi-danda-loop-s20fe', 'इन्टेक्स के लिए एक शीर्षक लिखिए।'],
    ['hindi-danda-loop-iphone', 'जिन्या बिनद के लिए एक शीर्षक लिखिए।'],
  ])(
    'cuts %s where the sentence ending in a danda starts repeating',
    (name, loopingSentence) => {
      const { raw } = answerNamed(name);
      const tidied = tidyVisibleAnswer(raw);
      expect(raw.split(loopingSentence).length - 1).toBeGreaterThan(40);
      expect(tidied.split(loopingSentence).length - 1).toBe(1);
      expect(tidied.endsWith('।')).toBe(true);
    }
  );

  it.each(['urdu-full-stop-loop', 'urdu-clause-pair-loop'])(
    'cuts %s where the sentence ending in ۔ starts repeating',
    (name) => {
      const { raw } = answerNamed(name);
      const tidied = tidyVisibleAnswer(raw);
      expect(mostRepeatedSentenceCount(raw)).toBeGreaterThan(20);
      expect(mostRepeatedSentenceCount(tidied)).toBeLessThanOrEqual(2);
      expect(tidied.length).toBeLessThan(raw.length / 4);
    }
  );

  it('cuts a single Devanagari letter repeated a hundred times', () => {
    const { raw } = answerNamed('devanagari-letter-run');
    const tidied = tidyVisibleAnswer(raw);
    expect(raw).toContain('द द द द द द द द');
    expect(tidied).not.toContain('द द');
    expect(tidied).toContain('1. न तात द');
  });
});

describe('benchmark answers that looped on a short unit (15.10 evening)', () => {
  it.each([
    ['devanagari-glued-syllable-loop-s25', 'करा', 'हो हो हो हो हो. हेकरा'],
    ['devanagari-glued-syllable-loop-iphone', 'वाद', 'बंगकरणकशवाद'],
    ['devanagari-glued-word-loop-iphone', 'तकरण', 'अंकतंगतकरण'],
    ['urdu-glued-full-stop-loop', 'ے۔', 'جھومتے ہے۔'],
  ])(
    'cuts %s, where %s repeats with no space between copies',
    (name, unit, ending) => {
      const { raw } = answerNamed(name);
      const tidied = tidyVisibleAnswer(raw);
      expect(raw).toContain(unit.repeat(10));
      expect(tidied.endsWith(ending)).toBe(true);
      expect(tidied).not.toContain(unit.repeat(2));
    }
  );

  it.each([
    ['devanagari-two-word-loop', 'तू न '],
    ['urdu-question-loop', 'یہ چھوٹا ہے یا گھٹا ہے؟ '],
    ['urdu-seven-word-loop', 'ہوا کی گہری ہونے کی وجہ سے '],
    ['urdu-long-phrase-loop', 'ہر 24 گھنٹے میں 1/4 سے 1/6 کے درمیان میں '],
  ])('cuts %s, which no clause, word or phrase check saw', (name, unit) => {
    const { raw } = answerNamed(name);
    const tidied = tidyVisibleAnswer(raw);
    expect(raw.split(unit).length - 1).toBeGreaterThan(20);
    expect(tidied.split(unit).length - 1).toBeLessThanOrEqual(1);
    expect(tidied.length).toBeLessThan(raw.length / 4);
  });

  it.each([
    ['table-hash-run', '#'],
    ['table-underscore-cell-loop', '______|'],
    ['table-space-run', ' '],
  ])('cuts %s, a run of hundreds of %j', (name, unit) => {
    const { raw } = answerNamed(name);
    const tidied = tidyVisibleAnswer(raw);
    expect(raw).toContain(unit.repeat(80));
    expect(tidied).not.toContain(unit.repeat(4));
  });
});

describe('benchmark answers the guard used to cut without a loop', () => {
  it.each([
    ['table-labels-across-columns', '| 149,600,000 km | 384,400 km |'],
    ['table-same-value-across-columns', '| **Orbital Period** |'],
    [
      'table-same-distance-across-columns',
      '| Distance from Earth | 149.6 million km | 149.6 million km | 149.6 million km |',
    ],
  ])(
    'keeps the whole table in %s when one row repeats a value in every column',
    (name, laterRow) => {
      const { raw } = answerNamed(name);
      const tidied = tidyVisibleAnswer(raw);
      expect(tidied).toContain(laterRow);
      expect(tidied).toBe(untouched(raw));
    }
  );

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

describe('stopping a loop while it streams', () => {
  const looping = [
    'hindi-danda-loop-s20fe',
    'hindi-danda-loop-iphone',
    'devanagari-letter-run',
    'urdu-full-stop-loop',
    'urdu-clause-pair-loop',
    'urdu-word-loop',
    'polish-paragraph-loop',
    'polish-repeated-sentence-loop',
    'devanagari-glued-syllable-loop-iphone',
    'devanagari-glued-word-loop-iphone',
    'devanagari-two-word-loop',
    'urdu-question-loop',
    'urdu-seven-word-loop',
    'urdu-long-phrase-loop',
    'table-hash-run',
    'table-underscore-cell-loop',
    'table-space-run',
  ];

  it.each(looping)(
    'stops %s before half of it is written, keeping the same answer',
    (name) => {
      const { raw } = answerNamed(name);
      const stop = stopPointWhileStreaming(raw);
      expect(stop).not.toBeNull();
      expect(stop!).toBeLessThan(raw.length / 2);
      expect(tidyVisibleAnswer(raw.slice(0, stop!))).toBe(
        tidyVisibleAnswer(raw)
      );
    }
  );

  it.each([
    ['devanagari-glued-syllable-loop-s25', 'करा'],
    ['urdu-glued-full-stop-loop', 'ے۔'],
  ])(
    'stops %s once its loop of %s has run on for a short tail',
    (name, unit) => {
      const { raw } = answerNamed(name);
      const stop = stopPointWhileStreaming(raw);
      expect(stop).not.toBeNull();
      expect(stop! - raw.indexOf(unit.repeat(2))).toBeLessThanOrEqual(
        RUNAWAY_TAIL_CHARS + 2 * unit.length
      );
      expect(tidyVisibleAnswer(raw.slice(0, stop!))).toBe(
        tidyVisibleAnswer(raw)
      );
    }
  );

  it.each([
    'table-labels-across-columns',
    'table-same-value-across-columns',
    'table-same-distance-across-columns',
    'polish-shared-sentence-tail',
  ])('never stops %s, which does not loop', (name) => {
    const { raw } = answerNamed(name);
    expect(stopPointWhileStreaming(raw)).toBeNull();
  });
});
