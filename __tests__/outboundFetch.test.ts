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

  it('flags loopback and RFC-1918 written in short inet_aton form', () => {
    expect(isPrivateHost('127.1')).toBe(true);
    expect(isPrivateHost('127.0.1')).toBe(true);
    expect(isPrivateHost('10.1')).toBe(true);
    expect(isPrivateHost('192.168.1')).toBe(true);
    expect(isPrivateHost('172.16.1')).toBe(true);
    expect(isPrivateHost('2130706433')).toBe(true);
  });

  it('flags octal and hex spellings', () => {
    expect(isPrivateHost('0177.0.0.1')).toBe(true);
    expect(isPrivateHost('0x7f.0.0.1')).toBe(true);
    expect(isPrivateHost('0x7f000001')).toBe(true);
    expect(isPrivateHost('0xc0.0xa8.0x0.0x1')).toBe(true);
  });

  it('flags a trailing-dot host', () => {
    expect(isPrivateHost('127.0.0.1.')).toBe(true);
  });

  it('flags IPv4 carried in the low 32 bits of an IPv6 literal', () => {
    expect(isPrivateHost('::ffff:7f00:1')).toBe(true);
    expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateHost('::ffff:c0a8:1')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
    expect(isPrivateHost('::')).toBe(true);
  });

  it('still allows public addresses written the same ways', () => {
    expect(isPrivateHost('8.8.8.8.')).toBe(false);
    expect(isPrivateHost('134744072')).toBe(false);
    expect(isPrivateHost('0x8.8.8.8')).toBe(false);
    expect(isPrivateHost('::ffff:808:808')).toBe(false);
    expect(isPrivateHost('2001:4860:4860::8888')).toBe(false);
  });

  it('does not mistake ordinary hostnames for numeric literals', () => {
    expect(isPrivateHost('123movies.example')).toBe(false);
    expect(isPrivateHost('10.example.com')).toBe(false);
    expect(isPrivateHost('0x7f.example.com')).toBe(false);
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
