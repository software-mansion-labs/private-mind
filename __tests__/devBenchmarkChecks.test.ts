import {
  checkAnswered,
  checkBlankLine,
  checkCutOff,
  checkGuardRetries,
  checkInstructionEcho,
  checkLanguage,
  checkListLength,
  checkLoop,
  checkLoopGuardCut,
  checkQuestionEcho,
  checkSpecialTokens,
  checkSpeed,
  checkTable,
  checkThinkingLeak,
  checkTurnTime,
  countListItems,
  hasMarkdownTable,
  loopGuardCutAnswer,
  mostRepeatedUnit,
  runTurnChecks,
  specialTokensIn,
  verdictAfterRetry,
  verdictOf,
  worstVerdict,
} from '../utils/devBenchmark/checks';
import { NO_ANSWER_FALLBACK } from '../constants/no-answer-fallback';
import type {
  CheckFinding,
  TurnObservation,
} from '../utils/devBenchmark/types';

const ENGLISH_ANSWER =
  'Leaves change colour because the tree stops making chlorophyll. ' +
  'The green fades and the yellow and orange pigments show through.';

const observation = (
  overrides: Partial<TurnObservation> = {}
): TurnObservation => ({
  turn: { prompt: 'Why do leaves change colour in autumn?', language: 'en' },
  turnTimeoutMs: 180_000,
  raw: ENGLISH_ANSWER,
  tidied: ENGLISH_ANSWER,
  final: ENGLISH_ANSWER,
  retries: [],
  generationError: null,
  timings: { ttftMs: 400, tokPerS: 18, turnMs: 9_000 },
  ...overrides,
});

const answering = (final: string, overrides: Partial<TurnObservation> = {}) =>
  observation({ raw: final, tidied: final, final, ...overrides });

describe('a clean English answer', () => {
  it('passes every check', () => {
    expect(runTurnChecks(observation())).toEqual([]);
  });
});

describe('checkAnswered', () => {
  it('fails a turn that ended in a generation error', () => {
    expect(
      checkAnswered(observation({ generationError: 'empty response' }))
    ).toMatchObject({ check: 'no-answer', severity: 'fail' });
  });

  it('fails a turn with nothing visible outside the thinking block', () => {
    expect(checkAnswered(answering('<think>pondering</think>'))).toMatchObject({
      check: 'no-answer',
      actual: 'nothing visible',
    });
  });

  it('accepts a turn with a visible answer', () => {
    expect(checkAnswered(observation())).toBeNull();
  });
});

describe('checkTurnTime', () => {
  it('fails a turn that ran past its limit', () => {
    expect(
      checkTurnTime(
        observation({ timings: { ttftMs: 1, tokPerS: 10, turnMs: 181_000 } })
      )
    ).toMatchObject({ check: 'turn-timeout', actual: '181 s' });
  });

  it('accepts a turn inside its limit', () => {
    expect(checkTurnTime(observation())).toBeNull();
  });
});

describe('checkLoopGuardCut', () => {
  it('fails when the loop guard shortened an answer that had no loop', () => {
    expect(
      checkLoopGuardCut(observation({ tidied: 'Leaves change colour.' }))
    ).toMatchObject({ check: 'loop-guard-cut', severity: 'fail' });
  });

  it('does not count text normalisation as a cut', () => {
    const raw = 'Ｗater boils at 100 degrees.';
    expect(loopGuardCutAnswer(raw, 'Water boils at 100 degrees.')).toBe(false);
  });

  it('ignores a turn that produced nothing', () => {
    expect(loopGuardCutAnswer('', '')).toBe(false);
  });

  it('leaves the thinking block out of the comparison', () => {
    const raw = '<think>plan</think>Ｗater boils.';
    expect(loopGuardCutAnswer(raw, '<think>plan</think>Water boils.')).toBe(
      false
    );
  });
});

describe('checkLoop', () => {
  const sentence = 'The tree pulls the nutrients back into its branches.';

  it('fails an answer that repeats one sentence three times', () => {
    expect(
      checkLoop(answering(`${sentence} ${sentence}\n${sentence}`))
    ).toMatchObject({ check: 'loop', severity: 'fail' });
  });

  it('shortens a long repeated sentence in the report', () => {
    const long =
      'The tree pulls the nutrients back into its branches before winter, ' +
      'so the leaves lose the green pigment that hid the other colours.';
    const result = checkLoop(answering([long, long, long].join('\n')));
    expect(result?.actual).toMatch(/…" ×3$/);
  });

  it('accepts a sentence said twice', () => {
    expect(checkLoop(answering(`${sentence}\n${sentence}`))).toBeNull();
  });

  it('ignores short repeated labels such as list subheadings', () => {
    const list = ['1. **Tip:** sleep', '2. **Tip:** read', '3. **Tip:** walk'];
    expect(checkLoop(answering(list.join('\n')))).toBeNull();
  });

  it('counts list items that differ only by their marker as one line', () => {
    expect(
      mostRepeatedUnit(`1. ${sentence}\n2. ${sentence}\n- ${sentence}`)
    ).toEqual({ unit: expect.any(String), count: 3 });
  });

  it('reports nothing for text without substantial units', () => {
    expect(mostRepeatedUnit('ok')).toBeNull();
  });
});

describe('checkLanguage', () => {
  it('fails an English reply to a Polish follow-up', () => {
    expect(
      checkLanguage(
        answering(ENGLISH_ANSWER, {
          turn: { prompt: 'a dlaczego?', language: 'pl' },
        })
      )
    ).toMatchObject({
      check: 'wrong-language',
      severity: 'fail',
      expected: 'Polish',
      actual: 'English',
    });
  });

  it('only warns when the greeting is answered in another language', () => {
    expect(
      checkLanguage(
        answering('Hello! How can I help you today?', {
          turn: { prompt: 'cześć', language: 'pl', greeting: true },
        })
      )
    ).toMatchObject({ check: 'greeting-language', severity: 'warn' });
  });

  it('cannot judge a question whose language is unknown', () => {
    expect(
      checkLanguage(
        answering(ENGLISH_ANSWER, { turn: { prompt: 'ok', language: 'en' } })
      )
    ).toBeNull();
  });

  it('cannot judge an answer whose language is unknown', () => {
    expect(
      checkLanguage(
        answering('42', { turn: { prompt: 'a dlaczego?', language: 'pl' } })
      )
    ).toBeNull();
  });

  it('accepts a reply in the language of the question', () => {
    expect(
      checkLanguage(
        answering('Cześć! W czym mogę Ci dzisiaj pomóc?', {
          turn: { prompt: 'cześć', language: 'pl', greeting: true },
        })
      )
    ).toBeNull();
  });
});

describe('checkQuestionEcho', () => {
  it('fails an answer that is the question itself', () => {
    expect(
      checkQuestionEcho(answering('Why do leaves change colour in autumn?'))
    ).toMatchObject({ check: 'question-echo', severity: 'fail' });
  });

  it.each(Object.values(NO_ANSWER_FALLBACK))(
    'fails the no-answer fallback "%s"',
    (fallback) => {
      expect(checkQuestionEcho(answering(fallback))).toMatchObject({
        check: 'question-echo',
      });
    }
  );

  it('accepts a real answer', () => {
    expect(checkQuestionEcho(observation())).toBeNull();
  });
});

describe('checkSpecialTokens', () => {
  it.each(['<|im_end|>', '<end_of_turn>', '<eos>', '</s>', '[INST]'])(
    'fails an answer carrying %s',
    (token) => {
      expect(
        checkSpecialTokens(answering(`${ENGLISH_ANSWER}${token}`))
      ).toMatchObject({ check: 'special-tokens', actual: token });
    }
  );

  it('reports each leaked token once', () => {
    expect(specialTokensIn('a<|im_end|> b<|im_end|> c<|')).toEqual([
      '<|im_end|>',
      '<|',
    ]);
  });

  it('ignores tokens inside the thinking block', () => {
    expect(specialTokensIn(`<think><|x|></think>${ENGLISH_ANSWER}`)).toEqual(
      []
    );
  });

  it('accepts a clean answer', () => {
    expect(checkSpecialTokens(observation())).toBeNull();
  });
});

describe('checkThinkingLeak', () => {
  it('fails an answer whose thinking never closed', () => {
    expect(
      checkThinkingLeak(answering('<think>Let me think about leaves'))
    ).toMatchObject({ check: 'thinking-leak', severity: 'fail' });
  });

  it('accepts a closed thinking block followed by the answer', () => {
    expect(
      checkThinkingLeak(answering(`<think>plan</think>${ENGLISH_ANSWER}`))
    ).toBeNull();
  });

  it('accepts an answer without thinking', () => {
    expect(checkThinkingLeak(observation())).toBeNull();
  });
});

describe('checkBlankLine', () => {
  it('fails an answer that opens with an empty line', () => {
    expect(checkBlankLine(answering(`\n${ENGLISH_ANSWER}`))).toMatchObject({
      check: 'blank-line',
    });
  });

  it('fails an opening line of spaces only', () => {
    expect(checkBlankLine(answering(`  \n${ENGLISH_ANSWER}`))).not.toBeNull();
  });

  it('leaves the gap after a thinking block alone', () => {
    expect(
      checkBlankLine(answering(`<think>\n\n</think>\n\n${ENGLISH_ANSWER}`))
    ).toBeNull();
  });

  it('accepts an answer that starts with text', () => {
    expect(checkBlankLine(observation())).toBeNull();
  });
});

describe('checkCutOff', () => {
  it('fails an answer that stops on a list introduction', () => {
    expect(
      checkCutOff(answering('Here are seven tips for better sleep:'))
    ).toMatchObject({ check: 'cut-off', severity: 'fail' });
  });

  it('fails an answer that stops on a bare list marker', () => {
    expect(checkCutOff(answering('Tips:\n1. Sleep early\n2.'))).toMatchObject({
      check: 'cut-off',
    });
  });

  it('fails an answer that stops mid-sentence', () => {
    expect(
      checkCutOff(answering('The green fades and the yellow pigments'))
    ).toMatchObject({ actual: expect.stringContaining('mid-sentence') });
  });

  it('fails an answer that stops on a comma', () => {
    expect(checkCutOff(answering('The green fades,'))).not.toBeNull();
  });

  it('fails a Hindi answer cut after a vowel sign', () => {
    expect(
      checkCutOff(answering('अच्छी नींद के लिए सोने से पहले'))
    ).not.toBeNull();
  });

  it('fails a table cut inside a row', () => {
    expect(
      checkCutOff(answering('| Body | Diameter |\n|---|---|\n| Sun | 1.39'))
    ).toMatchObject({ actual: 'ends inside a table row' });
  });

  it('accepts a table that ends with a closed row', () => {
    expect(
      checkCutOff(answering('| Body | Diameter |\n|---|---|\n| Sun | 1.39 |'))
    ).toBeNull();
  });

  it('accepts an answer ending with a list item', () => {
    expect(checkCutOff(answering('Tips:\n1. Sleep early\n2. Read'))).toBeNull();
  });

  it('accepts an answer ending in an emoji', () => {
    expect(checkCutOff(answering('Happy to help 🙂'))).toBeNull();
  });

  it.each(['Done.', 'Ready?', 'यह मदद करता है।', 'یہ ٹھیک ہے۔'])(
    'accepts "%s"',
    (text) => {
      expect(checkCutOff(answering(text))).toBeNull();
    }
  );

  it('has nothing to say about an empty answer', () => {
    expect(checkCutOff(answering(''))).toBeNull();
  });
});

describe('checkListLength', () => {
  const hindiList = (count: number) =>
    Array.from(
      { length: count },
      (_, index) => `${index + 1}. **शीर्षक** विवरण।`
    ).join('\n');
  const listTurn = {
    prompt: 'अच्छी नींद के लिए 7 सुझावों की सूची बनाइए।',
    language: 'hi',
    expectListItems: 7,
  };

  it('fails a list shorter than asked for', () => {
    expect(
      checkListLength(answering(hindiList(4), { turn: listTurn }))
    ).toMatchObject({ check: 'list-short', actual: '4 list items' });
  });

  it('accepts a list of the asked length', () => {
    expect(
      checkListLength(answering(hindiList(7), { turn: listTurn }))
    ).toBeNull();
  });

  it('leaves a turn without a list expectation alone', () => {
    expect(checkListLength(answering('1. one'))).toBeNull();
  });

  it('leaves an empty answer to the no-answer check', () => {
    expect(checkListLength(answering('', { turn: listTurn }))).toBeNull();
  });

  it('counts headed sections, bullets and native digits', () => {
    expect(countListItems('### नींद\ntext\n### पानी\ntext')).toBe(2);
    expect(countListItems('- a\n- b\n* c')).toBe(3);
    expect(countListItems('१. पहला\n२. दूसरा')).toBe(2);
    expect(countListItems('**1. Sleep**\n**2. Read**')).toBe(2);
  });
});

describe('checkTable', () => {
  const tableTurn = {
    prompt: 'Make a markdown table comparing the Sun and the Moon.',
    language: 'en',
    expectTable: true,
  };

  it('warns when a table was asked for and none came back', () => {
    expect(
      checkTable(answering(ENGLISH_ANSWER, { turn: tableTurn }))
    ).toMatchObject({ check: 'table-missing', severity: 'warn' });
  });

  it('accepts a markdown table', () => {
    const table = '| Body | Diameter |\n| :--- | ---: |\n| Sun | 1.39 |';
    expect(checkTable(answering(table, { turn: tableTurn }))).toBeNull();
    expect(hasMarkdownTable('a|b\n---|---\n1|2')).toBe(true);
  });

  it('leaves a turn without a table expectation alone', () => {
    expect(checkTable(observation())).toBeNull();
  });
});

describe('checkInstructionEcho', () => {
  it('warns when the language anchor is copied into the answer', () => {
    expect(
      checkInstructionEcho(
        answering('Cześć! (Answer in Polish.)', {
          turn: { prompt: 'cześć', language: 'pl', greeting: true },
        })
      )
    ).toMatchObject({ check: 'instruction-echo', severity: 'warn' });
  });

  it('warns on the generic anchor and on /no_think', () => {
    expect(
      checkInstructionEcho(
        answering('Hi (Answer in the same language as this message.) /no_think')
      )?.actual
    ).toContain('/no_think');
  });

  it('accepts an answer free of instructions', () => {
    expect(checkInstructionEcho(observation())).toBeNull();
  });
});

describe('checkGuardRetries', () => {
  it('warns for every guard retry with its reason', () => {
    const result = checkGuardRetries(
      observation({
        retries: [
          { reason: 'Answer in the wrong language', raw: 'x', accepted: true },
          { reason: 'Dangling list answer', raw: null, accepted: false },
        ],
      })
    );
    expect(result).toMatchObject({ check: 'guard-retry', severity: 'warn' });
    expect(result?.actual).toBe(
      'Answer in the wrong language (accepted); Dangling list answer (rejected)'
    );
  });

  it('accepts a turn without retries', () => {
    expect(checkGuardRetries(observation())).toBeNull();
  });
});

describe('checkSpeed', () => {
  const at = (tokPerS: number | null) =>
    observation({ timings: { ttftMs: 300, tokPerS, turnMs: 5_000 } });

  it.each([0, 1500])('warns about %s tok/s', (tokPerS) => {
    expect(checkSpeed(at(tokPerS))).toMatchObject({
      check: 'unreal-speed',
      severity: 'warn',
    });
  });

  it('accepts a plausible rate', () => {
    expect(checkSpeed(at(25))).toBeNull();
  });

  it('skips a turn without a measured rate', () => {
    expect(checkSpeed(at(null))).toBeNull();
  });

  it('skips a turn that failed anyway', () => {
    expect(
      checkSpeed(
        observation({
          generationError: 'boom',
          timings: { ttftMs: 0, tokPerS: 0, turnMs: 1 },
        })
      )
    ).toBeNull();
  });
});

describe('runTurnChecks', () => {
  it('lists failures before warnings', () => {
    const findings = runTurnChecks(
      answering('Here are the tips:', {
        retries: [{ reason: 'Dangling list', raw: null, accepted: false }],
      })
    );
    expect(findings.map((item) => item.severity)).toEqual(['fail', 'warn']);
  });
});

describe('verdicts', () => {
  const warn: CheckFinding = {
    check: 'guard-retry',
    severity: 'warn',
    expected: '',
    actual: '',
  };
  const fail: CheckFinding = { ...warn, check: 'loop', severity: 'fail' };

  it('takes the most severe finding', () => {
    expect(verdictOf([])).toBe('pass');
    expect(verdictOf([warn])).toBe('warn');
    expect(verdictOf([warn, fail])).toBe('fail');
  });

  it('turns a failure that passes on its retry yellow', () => {
    expect(verdictAfterRetry('fail', 'pass')).toBe('warn');
    expect(verdictAfterRetry('fail', 'warn')).toBe('warn');
  });

  it('keeps a failure red when the retry fails or never ran', () => {
    expect(verdictAfterRetry('fail', 'fail')).toBe('fail');
    expect(verdictAfterRetry('fail', null)).toBe('fail');
  });

  it('leaves a turn that did not fail as it was', () => {
    expect(verdictAfterRetry('pass', null)).toBe('pass');
    expect(verdictAfterRetry('warn', null)).toBe('warn');
  });

  it('picks the worst of several verdicts', () => {
    expect(worstVerdict([])).toBe('pass');
    expect(worstVerdict(['pass', 'warn'])).toBe('warn');
    expect(worstVerdict(['warn', 'fail', 'pass'])).toBe('fail');
  });
});
