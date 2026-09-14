import {
  charsetFromContentType,
  decodeBytes,
  decodeUtf8,
  sniffCharset,
} from '../utils/web/security/charset';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe('charsetFromContentType', () => {
  it('reads the charset parameter, whatever its case and quoting', () => {
    expect(charsetFromContentType('text/html; charset=ISO-8859-2')).toBe(
      'iso-8859-2'
    );
    expect(charsetFromContentType('text/html;charset="Windows-1250"')).toBe(
      'windows-1250'
    );
    expect(charsetFromContentType('text/html; charset=utf8')).toBe('utf-8');
  });

  it('maps latin1 and ascii labels onto windows-1252, as browsers do', () => {
    expect(charsetFromContentType('text/html; charset=iso-8859-1')).toBe(
      'windows-1252'
    );
    expect(charsetFromContentType('text/plain; charset=us-ascii')).toBe(
      'windows-1252'
    );
  });

  it('returns null without a charset or for one it cannot decode', () => {
    expect(charsetFromContentType('text/html')).toBeNull();
    expect(charsetFromContentType('text/html; charset=koi8-r')).toBeNull();
    expect(charsetFromContentType(null)).toBeNull();
  });
});

describe('sniffCharset', () => {
  it('defaults to utf-8', () => {
    expect(sniffCharset(utf8('<html></html>'), 'text/html')).toBe('utf-8');
  });

  it('lets a byte-order mark override the header', () => {
    expect(
      sniffCharset(
        bytes(0xef, 0xbb, 0xbf, 0x3c),
        'text/html; charset=iso-8859-2'
      )
    ).toBe('utf-8');
  });

  it('prefers the header over the meta tag', () => {
    expect(
      sniffCharset(
        utf8('<html><head><meta charset="windows-1250"></head></html>'),
        'text/html; charset=utf-8'
      )
    ).toBe('utf-8');
  });

  it('reads a meta charset when the header carries none', () => {
    expect(
      sniffCharset(
        utf8(
          '<!DOCTYPE html><html><head><meta charset="windows-1250"></head></html>'
        ),
        'text/html'
      )
    ).toBe('windows-1250');
    expect(
      sniffCharset(
        utf8(
          '<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-2"></head></html>'
        ),
        null
      )
    ).toBe('iso-8859-2');
  });

  it('ignores a meta charset past the sniffing window', () => {
    const late = `<html><head>${'<!-- padding -->'.repeat(200)}<meta charset="windows-1250"></head></html>`;
    expect(sniffCharset(utf8(late), 'text/html')).toBe('utf-8');
  });
});

describe('decodeBytes', () => {
  it('decodes the central European single-byte charsets', () => {
    expect(
      decodeBytes(bytes(0xb3, 0xf3, 0xbf, 0x20, 0xa5), 'windows-1250')
    ).toBe('łóż Ą');
    expect(decodeBytes(bytes(0xb1, 0xea, 0xb6), 'iso-8859-2')).toBe('ąęś');
    expect(decodeBytes(bytes(0x80, 0xe9, 0x41), 'windows-1252')).toBe('€éA');
  });

  it('keeps ascii bytes as they are in every single-byte charset', () => {
    expect(decodeBytes(utf8('<p>plain</p>'), 'windows-1250')).toBe(
      '<p>plain</p>'
    );
  });

  it('decodes utf-8 and drops its byte-order mark', () => {
    const text = 'zażółć gęślą jaźń 😀';
    expect(decodeBytes(utf8(text), 'utf-8')).toBe(text);
    expect(decodeBytes(bytes(0xef, 0xbb, 0xbf, ...utf8('x')), 'utf-8')).toBe(
      'x'
    );
  });

  it('decodes a body longer than one chunk without losing bytes', () => {
    const long = 'ł'.repeat(20_000);
    const encoded = new Uint8Array(long.length).fill(0xb3);
    expect(decodeBytes(encoded, 'windows-1250')).toBe(long);
  });
});

describe('decodeUtf8 without a TextDecoder', () => {
  const holder = global as unknown as { TextDecoder: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = holder.TextDecoder;
    holder.TextDecoder = undefined;
  });
  afterEach(() => {
    holder.TextDecoder = saved;
  });

  it('decodes two, three and four byte sequences', () => {
    const text = 'zażółć gęślą jaźń — 日本 😀';
    expect(decodeUtf8(utf8(text))).toBe(text);
  });

  it('replaces a stray byte and a truncated sequence, and carries on', () => {
    expect(decodeUtf8(bytes(0x41, 0xff, 0x42))).toBe('A�B');
    expect(decodeUtf8(bytes(0x41, 0xe2, 0x82))).toBe('A�');
    expect(decodeUtf8(bytes(0xc0, 0x80))).toBe('��');
  });

  it('handles a body longer than one chunk', () => {
    const text = 'ą'.repeat(20_000);
    expect(decodeUtf8(utf8(text))).toBe(text);
  });
});
