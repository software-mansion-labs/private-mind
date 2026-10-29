import {
  GLOW_COLOURS,
  GLOW_PULSE_STRENGTH,
  GLOW_REST,
  GLOW_TIMING,
  HIDDEN_GLOW,
  answerColour,
  type GlowFrame,
  type GlowSegment,
  forgetGlow,
  glowEndsAt,
  glowFrameAt,
  initialGlowSegment,
  nextGlowSegment,
  rememberGlow,
} from '../components/chat-screen/thinkingGlowMotion';

const PULSE = GLOW_PULSE_STRENGTH;
const EMPTY = { isEmpty: true, awaitingReply: false };
const WAITING = { isEmpty: false, awaitingReply: true };
const ANSWERED = { isEmpty: false, awaitingReply: false };

const frameAt = (segment: GlowSegment, now: number) =>
  glowFrameAt(segment, now, PULSE);

const expectClose = (a: GlowFrame, b: GlowFrame) => {
  expect(a.cy).toBeCloseTo(b.cy, 2);
  expect(a.thick).toBeCloseTo(b.thick, 2);
  expect(a.alpha).toBeCloseTo(b.alpha, 2);
  a.colour.forEach((channel, i) => expect(channel).toBeCloseTo(b.colour[i], 0));
};

const restingSegment = (): GlowSegment =>
  initialGlowSegment(1, EMPTY, 0, PULSE);

const restStart = 0;

describe('thinking glow', () => {
  afterEach(forgetGlow);

  it('rises a new empty chat glow in brand blue from below the screen into rest', () => {
    const open = restingSegment();
    const first = frameAt(open, 0);
    const risen = glowFrameAt(open, GLOW_TIMING.riseMs, 0);

    expect(open.kind).toBe('open');
    expect(first.cy).toBeGreaterThan(1);
    expect(first.alpha).toBe(0);
    expect(first.colour).toEqual(GLOW_COLOURS[0]);
    expect(risen.cy).toBeCloseTo(GLOW_REST.cy);
    expect(risen.alpha).toBe(1);
  });

  it('reports the rise progress so the cloud can come up unevenly, and is fully risen at rest', () => {
    const open = restingSegment();

    expect(frameAt(open, 0).rise).toBe(0);
    expect(frameAt(open, GLOW_TIMING.riseMs / 2).rise).toBeCloseTo(0.5);
    expect(frameAt(open, GLOW_TIMING.riseMs).rise).toBe(1);
  });

  it('pulses at rest for as long as nothing is sent', () => {
    const open = restingSegment();
    const halfBreath = GLOW_TIMING.pulsePeriodMs / 2;
    const later = restStart + 20 * GLOW_TIMING.pulsePeriodMs;

    expect(frameAt(open, later).pulse).toBeCloseTo(0);
    expect(frameAt(open, later + halfBreath).pulse).toBeCloseTo(PULSE);
  });

  it('keeps still at rest when reduced motion turns the pulse off', () => {
    const open = restingSegment();
    const midBreath = restStart + 10.5 * GLOW_TIMING.pulsePeriodMs;

    expect(glowFrameAt(open, midBreath, 0).pulse).toBe(0);
  });

  it('lifts from wherever the pulse was when the message is sent', () => {
    const open = restingSegment();
    const sentAt = restStart + 5.5 * GLOW_TIMING.pulsePeriodMs;
    const send = nextGlowSegment(open, WAITING, sentAt, PULSE);

    expect(send.kind).toBe('send');
    expectClose(frameAt(send, sentAt), frameAt(open, sentAt));
  });

  it('sinks behind the composer and keeps thinking until the reply starts', () => {
    const send = nextGlowSegment(restingSegment(), WAITING, restStart, PULSE);
    const longWait = restStart + GLOW_TIMING.liftMs + 30_000;

    expect(frameAt(send, restStart + GLOW_TIMING.liftMs).cy).toBeGreaterThan(
      GLOW_REST.cy + 0.2
    );
    expect(frameAt(send, longWait).alpha).toBe(1);
    expect(nextGlowSegment(send, WAITING, longWait, PULSE)).toBe(send);
  });

  it('flares into a lighter shade of its own colour when the reply starts, then sinks away', () => {
    const send = nextGlowSegment(restingSegment(), WAITING, restStart, PULSE);
    const repliedAt = restStart + GLOW_TIMING.liftMs + 2000;
    const answer = nextGlowSegment(send, ANSWERED, repliedAt, PULSE);
    const flared = repliedAt + GLOW_TIMING.answerMs;

    expect(answer.kind).toBe('answer');
    expectClose(frameAt(answer, repliedAt), frameAt(send, repliedAt));
    const replyStartColour = frameAt(send, repliedAt).colour;
    frameAt(answer, flared).colour.forEach((channel, i) =>
      expect(channel).toBeCloseTo(answerColour(replyStartColour)[i], 0)
    );
    expect(frameAt(answer, flared + GLOW_TIMING.fadeMs).alpha).toBe(0);
    expect(frameAt(answer, flared + GLOW_TIMING.fadeMs).cy).toBeGreaterThan(1);
    expect(glowEndsAt(answer)).toBe(flared + GLOW_TIMING.fadeMs);
  });

  it('settles back to rest without a jump when a send fails and the chat empties', () => {
    const send = nextGlowSegment(restingSegment(), WAITING, restStart, PULSE);
    const failedAt = restStart + 400;
    const settle = nextGlowSegment(send, EMPTY, failedAt, PULSE);

    expect(settle.kind).toBe('settle');
    expectClose(frameAt(settle, failedAt), frameAt(send, failedAt));
    expect(
      glowFrameAt(settle, failedAt + GLOW_TIMING.settleMs, 0).cy
    ).toBeCloseTo(GLOW_REST.cy);
  });

  it('starts the resting glow on a conversation screen as soon as its messages are cleared for a new chat', () => {
    const conversation = initialGlowSegment(3, ANSWERED, 0, PULSE);

    expect(nextGlowSegment(conversation, EMPTY, 10, PULSE)).toEqual({
      kind: 'open',
      at: 10,
    });
  });

  it('carries the resting glow onto the new chat screen that replaces the old one', () => {
    const leaving = restingSegment();
    rememberGlow(3, leaving);

    expect(initialGlowSegment(4, EMPTY, 800, PULSE)).toBe(leaving);
  });

  it('fades a carried resting glow out, without a flare, when an existing conversation opens', () => {
    const resting = restingSegment();
    rememberGlow(4, resting);
    const openedAt = 5000;
    const conversation = initialGlowSegment(9, ANSWERED, openedAt, PULSE);

    expect(conversation.kind).toBe('leave');
    expectClose(frameAt(conversation, openedAt), frameAt(resting, openedAt));
    expect(frameAt(conversation, openedAt + GLOW_TIMING.leaveMs).alpha).toBe(0);
    expect(glowEndsAt(conversation)).toBe(openedAt + GLOW_TIMING.leaveMs);
  });

  it('stays out of later turns of a conversation', () => {
    const answered = nextGlowSegment(HIDDEN_GLOW, ANSWERED, 0, PULSE);

    expect(nextGlowSegment(answered, WAITING, 10, PULSE)).toBe(HIDDEN_GLOW);
  });

  it('keeps thinking through a remount of the same chat, but not on another chat', () => {
    const send = nextGlowSegment(restingSegment(), WAITING, 0, PULSE);
    rememberGlow(7, send);

    expect(initialGlowSegment(7, WAITING, 500, PULSE)).toBe(send);
    expect(initialGlowSegment(8, ANSWERED, 500, PULSE)).toBe(HIDDEN_GLOW);
  });
});
