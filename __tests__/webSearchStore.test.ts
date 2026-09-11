import { useWebSearchStore, WEB_TRACE_MAX } from '../store/webSearchStore';

const reset = () =>
  useWebSearchStore.setState({
    enabledByChat: {},
    webSearchTrace: [],
    challengeHandlers: null,
    challengeActive: false,
  });

beforeEach(reset);

describe('useWebSearchStore', () => {
  it('defaults to disabled for an unknown chat', () => {
    expect(useWebSearchStore.getState().isEnabled(1)).toBe(false);
  });

  it('returns false for a null chat id', () => {
    expect(useWebSearchStore.getState().isEnabled(null)).toBe(false);
  });

  it('remembers the flag per chat', () => {
    const { setEnabled, isEnabled } = useWebSearchStore.getState();
    setEnabled(1, true);
    setEnabled(2, false);

    expect(isEnabled(1)).toBe(true);
    expect(isEnabled(2)).toBe(false);
    expect(isEnabled(3)).toBe(false);
  });

  it('ignores setEnabled for a null chat id', () => {
    useWebSearchStore.getState().setEnabled(null, true);
    expect(useWebSearchStore.getState().enabledByChat).toEqual({});
  });

  it('moves the flag from one chat id to another (phantom → real)', () => {
    const { setEnabled, transfer, isEnabled } = useWebSearchStore.getState();
    setEnabled(-100, true);

    transfer(-100, 42);

    expect(isEnabled(42)).toBe(true);
    expect(isEnabled(-100)).toBe(false);
    expect((-100) in useWebSearchStore.getState().enabledByChat).toBe(false);
  });

  it('does not create an entry when transferring from an unset chat id', () => {
    useWebSearchStore.getState().transfer(-1, 7);
    expect(useWebSearchStore.getState().enabledByChat).toEqual({});
    expect(useWebSearchStore.getState().isEnabled(7)).toBe(false);
  });

  it('transfers a disabled flag too (does not force-enable the new chat)', () => {
    const { setEnabled, transfer, isEnabled } = useWebSearchStore.getState();
    setEnabled(-100, false);

    transfer(-100, 42);

    expect(isEnabled(42)).toBe(false);
  });

  it('keeps the trace expanded across the searching→settled transition', () => {
    useWebSearchStore.setState({ isSearchingWeb: false, traceExpanded: false });
    useWebSearchStore.getState().setSearchingWeb(true);
    useWebSearchStore.getState().setTraceExpanded(true);

    useWebSearchStore.getState().setSearchingWeb(false);

    expect(useWebSearchStore.getState().traceExpanded).toBe(true);
  });

  it('collapses the trace again when a fresh search starts', () => {
    useWebSearchStore.setState({ isSearchingWeb: false, traceExpanded: true });

    useWebSearchStore.getState().setSearchingWeb(true);

    expect(useWebSearchStore.getState().traceExpanded).toBe(false);
  });

  it('clearEnabled removes a chat entry entirely', () => {
    const { setEnabled, clearEnabled, isEnabled } =
      useWebSearchStore.getState();
    setEnabled(5, true);
    expect(isEnabled(5)).toBe(true);

    clearEnabled(5);

    expect(isEnabled(5)).toBe(false);
    expect(5 in useWebSearchStore.getState().enabledByChat).toBe(false);
  });

  it('a fresh search clears a stale active challenge', () => {
    useWebSearchStore.setState({
      isSearchingWeb: false,
      challengeActive: true,
    });

    useWebSearchStore.getState().setSearchingWeb(true);

    expect(useWebSearchStore.getState().challengeActive).toBe(false);
  });

  it('collapses the trace on reset', () => {
    useWebSearchStore.setState({ traceExpanded: true });
    useWebSearchStore.getState().resetTrace();
    expect(useWebSearchStore.getState().traceExpanded).toBe(false);
  });
});

describe('pushWebSearchEvent', () => {
  it('appends entries with unique ascending ids', () => {
    const { pushWebSearchEvent } = useWebSearchStore.getState();
    pushWebSearchEvent({ type: 'searching', query: 'a' });
    pushWebSearchEvent({ type: 'fetched', host: 'x' });

    const trace = useWebSearchStore.getState().webSearchTrace;
    expect(trace).toHaveLength(2);
    expect(trace[0]!.type).toBe('searching');
    expect(trace[1]!.id).toBeGreaterThan(trace[0]!.id);
  });

  it('caps the trace at WEB_TRACE_MAX and keeps the most recent entries', () => {
    const { pushWebSearchEvent } = useWebSearchStore.getState();
    for (let i = 0; i < WEB_TRACE_MAX + 10; i++) {
      pushWebSearchEvent({ type: 'searching', query: `q${i}` });
    }

    const trace = useWebSearchStore.getState().webSearchTrace;
    expect(trace).toHaveLength(WEB_TRACE_MAX);
    expect(trace[trace.length - 1]!.query).toBe(`q${WEB_TRACE_MAX + 9}`);
    expect(trace[0]!.query).toBe('q10');
  });
});

describe('challenge handlers', () => {
  it('opens through the registered handler', () => {
    const open = jest.fn();
    useWebSearchStore
      .getState()
      .registerChallengeHandlers({ open, cancel: jest.fn() });

    useWebSearchStore.getState().openChallenge();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('cancel clears the active flag and calls the handler', () => {
    const cancel = jest.fn();
    useWebSearchStore.setState({ challengeActive: true });
    useWebSearchStore
      .getState()
      .registerChallengeHandlers({ open: jest.fn(), cancel });

    useWebSearchStore.getState().cancelChallenge();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(useWebSearchStore.getState().challengeActive).toBe(false);
  });

  it('open and cancel are safe no-ops when no handler is registered', () => {
    expect(() => useWebSearchStore.getState().openChallenge()).not.toThrow();
    expect(() => useWebSearchStore.getState().cancelChallenge()).not.toThrow();
    expect(useWebSearchStore.getState().challengeActive).toBe(false);
  });
});

describe('challengePolicy', () => {
  it('defaults to ask and updates in place', () => {
    expect(useWebSearchStore.getState().challengePolicy).toBe('ask');
    useWebSearchStore.getState().updateChallengePolicy('skip');
    expect(useWebSearchStore.getState().challengePolicy).toBe('skip');
  });
});
