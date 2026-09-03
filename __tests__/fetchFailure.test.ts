import {
  classifyFetchError,
  classifyUnusableContent,
  describeFetchFailure,
  isHostLevelFailure,
  isRecoverableFailure,
  summarizeFetchFailures,
  type FetchFailure,
} from '../utils/web/fetchFailure';

const failure = (
  host: string,
  reason: FetchFailure['reason']
): FetchFailure => ({ url: `https://${host}/a`, host, reason });

describe('classifyFetchError — reads the errors outboundFetch actually throws', () => {
  it('separates a timeout from a plain network failure', () => {
    expect(
      classifyFetchError(new Error('Fetch timed out: https://a.example/x'))
    ).toBe('timeout');
    expect(
      classifyFetchError(new Error('Fetch failed: https://a.example/x'))
    ).toBe('network');
  });

  it('reads an abort as its own reason, not as a site problem', () => {
    expect(
      classifyFetchError(new Error('Fetch aborted: https://a.example/x'))
    ).toBe('aborted');
  });

  it('maps refusal statuses to blocked', () => {
    for (const status of [401, 403, 429, 451]) {
      expect(
        classifyFetchError(new Error(`Fetch failed: ${status} Forbidden`))
      ).toBe('blocked');
    }
  });

  it('maps a missing page to not-found and a broken site to server-error', () => {
    expect(classifyFetchError(new Error('Fetch failed: 404 Not Found'))).toBe(
      'not-found'
    );
    expect(classifyFetchError(new Error('Fetch failed: 410 Gone'))).toBe(
      'not-found'
    );
    expect(
      classifyFetchError(new Error('Fetch failed: 503 Service Unavailable'))
    ).toBe('server-error');
  });

  it('treats a body it cannot read as unsupported rather than a fetch failure', () => {
    expect(
      classifyFetchError(new Error('Unsupported content type: application/pdf'))
    ).toBe('unsupported');
    expect(
      classifyFetchError(
        new Error('Refusing to read a binary body: https://a.example/f.pdf')
      )
    ).toBe('unsupported');
  });

  it('keeps size limits distinct from everything else', () => {
    expect(
      classifyFetchError(new Error('Response too large: 3000000 bytes'))
    ).toBe('too-large');
    expect(
      classifyFetchError(
        new Error('Response too large: content-length 9000000')
      )
    ).toBe('too-large');
  });

  it('reads our own security refusals as blocked', () => {
    expect(
      classifyFetchError(
        new Error('Refusing to fetch private-range host: 10.0.0.1')
      )
    ).toBe('blocked');
    expect(
      classifyFetchError(
        new Error('Refusing redirect to private url: http://127.0.0.1/')
      )
    ).toBe('blocked');
  });

  it('falls back to network for anything unrecognised, including non-Errors', () => {
    expect(classifyFetchError(new Error('kaboom'))).toBe('network');
    expect(classifyFetchError('kaboom')).toBe('network');
    expect(classifyFetchError(undefined)).toBe('network');
  });
});

describe('classifyUnusableContent — a page that loaded but gave nothing usable', () => {
  it('calls a bot wall blocked and an empty page empty', () => {
    expect(classifyUnusableContent(true)).toBe('blocked');
    expect(classifyUnusableContent(false)).toBe('empty');
  });
});

describe('failure shape drives what recovery is worth trying', () => {
  it('treats only whole-site failures as host-level', () => {
    expect(isHostLevelFailure('blocked')).toBe(true);
    expect(isHostLevelFailure('server-error')).toBe(true);
    expect(isHostLevelFailure('not-found')).toBe(false);
    expect(isHostLevelFailure('unsupported')).toBe(false);
    expect(isHostLevelFailure('empty')).toBe(false);
  });

  it('does not treat a user-cancelled fetch as something to recover from', () => {
    expect(isRecoverableFailure('aborted')).toBe(false);
    expect(isRecoverableFailure('blocked')).toBe(true);
    expect(isRecoverableFailure('timeout')).toBe(true);
  });
});

describe('summarizeFetchFailures — the line the user actually reads', () => {
  it('says nothing when nothing recoverable failed', () => {
    expect(summarizeFetchFailures([])).toBe('');
    expect(summarizeFetchFailures([failure('a.example', 'aborted')])).toBe('');
  });

  it('counts the pages and names the most common reason', () => {
    expect(summarizeFetchFailures([failure('a.example', 'blocked')])).toBe(
      'Couldn’t read 1 page — blocked the reader'
    );
    expect(
      summarizeFetchFailures([
        failure('a.example', 'blocked'),
        failure('b.example', 'blocked'),
        failure('c.example', 'timeout'),
      ])
    ).toBe('Couldn’t read 3 pages — blocked the reader');
  });

  it('leaves an aborted fetch out of the count', () => {
    expect(
      summarizeFetchFailures([
        failure('a.example', 'blocked'),
        failure('b.example', 'aborted'),
      ])
    ).toBe('Couldn’t read 1 page — blocked the reader');
  });

  it('has a label for every reason', () => {
    const reasons: FetchFailure['reason'][] = [
      'blocked',
      'not-found',
      'server-error',
      'timeout',
      'unsupported',
      'too-large',
      'empty',
      'network',
      'aborted',
    ];
    for (const reason of reasons) {
      expect(describeFetchFailure(reason)).toBeTruthy();
    }
  });
});
