import {
  isHttpUrl,
  isPrivateHost,
  assertPublicHttpUrl,
} from '../utils/web/security/outboundFetch';

describe('isHttpUrl', () => {
  it('accepts http(s), case-insensitively', () => {
    expect(isHttpUrl('http://x.com')).toBe(true);
    expect(isHttpUrl('https://x.com')).toBe(true);
    expect(isHttpUrl('HTTPS://x.com')).toBe(true);
  });

  it('rejects other schemes and protocol-relative urls', () => {
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('ftp://x.com')).toBe(false);
    expect(isHttpUrl(`${'java'}script:alert(1)`)).toBe(false);
    expect(isHttpUrl('//x.com')).toBe(false);
  });
});

describe('isPrivateHost', () => {
  it('flags loopback and localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('foo.localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('127.5.5.5')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
    expect(isPrivateHost('[::1]')).toBe(true);
  });

  it('flags RFC-1918, link-local and CGNAT ranges', () => {
    expect(isPrivateHost('10.0.0.5')).toBe(true);
    expect(isPrivateHost('192.168.1.1')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.31.255.255')).toBe(true);
    expect(isPrivateHost('169.254.169.254')).toBe(true);
    expect(isPrivateHost('100.64.0.1')).toBe(true);
    expect(isPrivateHost('0.0.0.0')).toBe(true);
  });

  it('flags IPv6 ULA and link-local prefixes', () => {
    expect(isPrivateHost('fe80::1')).toBe(true);
    expect(isPrivateHost('fc00::1')).toBe(true);
    expect(isPrivateHost('fd12:3456::1')).toBe(true);
  });

  it('allows public hosts and public IPs, incl. range boundaries', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('11.0.0.1')).toBe(false);
    expect(isPrivateHost('172.15.0.1')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('100.63.0.1')).toBe(false);
    expect(isPrivateHost('100.128.0.1')).toBe(false);
  });
});

describe('assertPublicHttpUrl', () => {
  it('returns the host for a public http(s) url', () => {
    expect(assertPublicHttpUrl('https://example.com/a')).toBe('example.com');
  });

  it('throws on a non-http scheme', () => {
    expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow();
  });

  it('throws on a private host', () => {
    expect(() => assertPublicHttpUrl('http://192.168.1.1/')).toThrow();
    expect(() => assertPublicHttpUrl('http://127.0.0.1:9000/')).toThrow();
    expect(() => assertPublicHttpUrl('http://localhost/')).toThrow();
  });

  it('throws on a malformed url', () => {
    expect(() => assertPublicHttpUrl('http://')).toThrow();
  });
});
