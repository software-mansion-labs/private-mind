/* eslint-disable no-bitwise */
export type Charset = 'utf-8' | 'windows-1252' | 'windows-1250' | 'iso-8859-2';

const CHARSET_LABELS: Readonly<Record<string, Charset>> = {
  'utf-8': 'utf-8',
  'utf8': 'utf-8',
  'unicode-1-1-utf-8': 'utf-8',
  'us-ascii': 'windows-1252',
  'ascii': 'windows-1252',
  'iso-8859-1': 'windows-1252',
  'iso8859-1': 'windows-1252',
  'iso_8859-1': 'windows-1252',
  'latin1': 'windows-1252',
  'l1': 'windows-1252',
  'cp1252': 'windows-1252',
  'windows-1252': 'windows-1252',
  'x-cp1252': 'windows-1252',
  'iso-8859-2': 'iso-8859-2',
  'iso8859-2': 'iso-8859-2',
  'iso_8859-2': 'iso-8859-2',
  'latin2': 'iso-8859-2',
  'l2': 'iso-8859-2',
  'cp1250': 'windows-1250',
  'windows-1250': 'windows-1250',
  'x-cp1250': 'windows-1250',
};

const UPPER_HALF: Readonly<Record<Exclude<Charset, 'utf-8'>, string>> = {
  'windows-1252':
    '€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ',
  'windows-1250':
    '€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙',
  'iso-8859-2':
    ' Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙',
};

const CHARSET_PARAM = /charset\s*=\s*["']?\s*([A-Za-z0-9._:-]+)/i;
const META_CHARSET = /<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9._:-]+)/i;
const SNIFF_PREFIX_BYTES = 2048;
const CHUNK = 8192;

export const charsetFromLabel = (
  label: string | null | undefined
): Charset | null =>
  label ? (CHARSET_LABELS[label.trim().toLowerCase()] ?? null) : null;

export const charsetFromContentType = (
  contentType: string | null | undefined
): Charset | null => charsetFromLabel(contentType?.match(CHARSET_PARAM)?.[1]);

const hasUtf8Bom = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 &&
  bytes[0] === 0xef &&
  bytes[1] === 0xbb &&
  bytes[2] === 0xbf;

export const latin1 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += CHUNK) {
    parts.push(
      String.fromCharCode.apply(
        null,
        bytes.subarray(at, at + CHUNK) as unknown as number[]
      )
    );
  }
  return parts.join('');
};

export const sniffCharset = (
  bytes: Uint8Array,
  contentType: string | null | undefined
): Charset => {
  if (hasUtf8Bom(bytes)) return 'utf-8';
  const fromHeader = charsetFromContentType(contentType);
  if (fromHeader) return fromHeader;
  const head = latin1(bytes.subarray(0, SNIFF_PREFIX_BYTES));
  return charsetFromLabel(head.match(META_CHARSET)?.[1]) ?? 'utf-8';
};

const decodeSingleByte = (bytes: Uint8Array, table: string): string => {
  const units = new Array<number>(Math.min(bytes.length, CHUNK));
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += CHUNK) {
    const end = Math.min(at + CHUNK, bytes.length);
    units.length = end - at;
    for (let i = at; i < end; i++) {
      const byte = bytes[i]!;
      units[i - at] = byte < 0x80 ? byte : table.charCodeAt(byte - 0x80);
    }
    parts.push(String.fromCharCode.apply(null, units));
  }
  return parts.join('');
};

const REPLACEMENT = 0xfffd;

export const decodeUtf8 = (bytes: Uint8Array): string => {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  const units: number[] = [];
  const parts: string[] = [];
  const flush = () => {
    parts.push(String.fromCharCode.apply(null, units));
    units.length = 0;
  };
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i]!;
    const needed = continuationBytesAfter(lead);
    const have = continuationBytesPresent(bytes, i + 1, needed);
    let codePoint = REPLACEMENT;
    if (lead < 0x80) {
      codePoint = lead;
    } else if (needed > 0 && have === needed) {
      codePoint = lead & (0x3f >> needed);
      for (let k = 1; k <= needed; k++) {
        codePoint = (codePoint << 6) | (bytes[i + k]! & 0x3f);
      }
      if (!isScalarValue(codePoint, needed)) codePoint = REPLACEMENT;
    }
    if (codePoint > 0xffff) {
      const offset = codePoint - 0x10000;
      units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      units.push(codePoint);
    }
    if (units.length >= CHUNK) flush();
    i += 1 + have;
  }
  flush();
  return parts.join('');
};

const continuationBytesAfter = (lead: number): number => {
  if (lead >= 0xc2 && lead <= 0xdf) return 1;
  if (lead >= 0xe0 && lead <= 0xef) return 2;
  if (lead >= 0xf0 && lead <= 0xf4) return 3;
  return 0;
};

const continuationBytesPresent = (
  bytes: Uint8Array,
  from: number,
  wanted: number
): number => {
  let count = 0;
  while (count < wanted && from + count < bytes.length) {
    if ((bytes[from + count]! & 0xc0) !== 0x80) break;
    count += 1;
  }
  return count;
};

const MIN_SCALAR_BY_LENGTH = [0, 0x80, 0x800, 0x10000];

const isScalarValue = (codePoint: number, needed: number): boolean =>
  codePoint >= MIN_SCALAR_BY_LENGTH[needed]! &&
  codePoint <= 0x10ffff &&
  (codePoint < 0xd800 || codePoint > 0xdfff);

export const decodeBytes = (bytes: Uint8Array, charset: Charset): string => {
  if (charset === 'utf-8') {
    return decodeUtf8(hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes);
  }
  return decodeSingleByte(bytes, UPPER_HALF[charset]);
};
