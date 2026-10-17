import { listenToAnswerTraces, recordAnswerTrace } from '../utils/answerTrace';
import type { AnswerTrace } from '../utils/answerTrace';
import { writtenFiles } from '../__mocks__/react-native-fs';

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

beforeEach(() => {
  writtenFiles.clear();
});

describe('recordAnswerTrace', () => {
  it('ships off, so a release build writes nothing', async () => {
    await recordAnswerTrace(trace);

    expect(writtenFiles.size).toBe(0);
  });

  it('keeps the answer the model produced beside the one the user saw', async () => {
    await recordAnswerTrace(trace, { toFile: true });

    const [path] = [...writtenFiles.keys()];
    expect(path).toContain('/answer-traces/');
    const parsed = JSON.parse([...writtenFiles.values()][0]!);
    expect(parsed.raw).toContain('krypton');
    expect(parsed.final).toBe('The six naturally');
    expect(parsed.retries[0].reason).toContain('Circular');
  });
});

describe('listenToAnswerTraces', () => {
  it('hands every trace to a listener even when nothing is written to disk', async () => {
    const heard: string[] = [];
    const stop = listenToAnswerTraces((received) => heard.push(received.raw));

    await recordAnswerTrace(trace);
    stop();

    expect(heard).toEqual([trace.raw]);
    expect(writtenFiles.size).toBe(0);
  });

  it('stops hearing traces once the listener is removed', async () => {
    const listener = jest.fn();
    const stop = listenToAnswerTraces(listener);
    stop();

    await recordAnswerTrace(trace);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps writing the trace when a listener throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = listenToAnswerTraces(() => {
      throw new Error('listener broke');
    });

    await recordAnswerTrace(trace, { toFile: true });
    stop();

    expect(writtenFiles.size).toBe(1);
    warn.mockRestore();
  });
});
