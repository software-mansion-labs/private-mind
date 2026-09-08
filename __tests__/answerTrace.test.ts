import type { AnswerTrace } from '../utils/answerTrace';

const trace: AnswerTrace = {
  question: 'What are the six noble gases',
  raw: 'The six naturally occurring noble gases are helium, neon, argon, krypton, xenon and radon. The six naturally occurring noble gases are helium, neon, argon, krypton, xenon and radon.',
  tidied: 'The six naturally',
  retries: [
    {
      reason: 'Circular non-answer, retrying once',
      raw: null,
      accepted: false,
    },
  ],
  final: 'The six naturally',
  systemPromptChars: 2480,
};

const load = (overrides: Record<string, unknown> = {}) => {
  jest.resetModules();
  jest.doMock('../constants/web', () => ({
    ...jest.requireActual('../constants/web'),
    ...overrides,
  }));
  const fs =
    require('../__mocks__/react-native-fs') as typeof import('../__mocks__/react-native-fs');
  fs.writtenFiles.clear();
  return {
    ...(require('../utils/answerTrace') as typeof import('../utils/answerTrace')),
    writtenFiles: fs.writtenFiles,
  };
};

describe('recordAnswerTrace', () => {
  it('ships off, so a release build writes nothing', async () => {
    const { recordAnswerTrace, writtenFiles } = load();

    await recordAnswerTrace(trace);

    expect(writtenFiles.size).toBe(0);
  });

  it('keeps the answer the model produced beside the one the user saw', async () => {
    const { recordAnswerTrace, writtenFiles } = load({
      WEB_TRACE_TO_FILE: true,
    });

    await recordAnswerTrace(trace);

    const [path] = [...writtenFiles.keys()];
    expect(path).toContain('/answer-traces/');
    const parsed = JSON.parse([...writtenFiles.values()][0]!);
    expect(parsed.raw).toContain('krypton');
    expect(parsed.final).toBe('The six naturally');
    expect(parsed.retries[0].reason).toContain('Circular');
  });
});
