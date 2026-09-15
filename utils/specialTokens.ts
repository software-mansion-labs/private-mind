const SENTINEL_NOTATIONS = [
  /<\|[^<>|]{0,64}\|?>/,
  /<[^<>|]{1,64}\|>/,
  /<unused\d{1,6}>/,
  /<extra_id_\d{1,6}>/,
  /<reserved_special_token_\d{1,6}>/,
  /<madeupword\d{1,6}>/,
  /<0x[0-9A-Fa-f]{2}>/,
  /<\/?(?:start_of_turn|end_of_turn|end_of_text|begin_of_text)>/,
  /<\/?(?:pad|eos|bos|unk|mask|sep|cls)>/,
];

const SENTINEL_RUN = new RegExp(
  `([^\\S\\n]*)(?:${SENTINEL_NOTATIONS.map((p) => p.source).join('|')})+([^\\S\\n]*)`,
  'gi'
);

const CODE_SPAN = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;

const withoutSentinels = (text: string): string =>
  text.replace(SENTINEL_RUN, (_match, before: string, after: string) =>
    before && after ? ' ' : ''
  );

export const stripSpecialTokens = (text: string): string => {
  if (!text || !text.includes('<')) return text;

  let out = '';
  let cursor = 0;

  for (const span of text.matchAll(CODE_SPAN)) {
    const start = span.index ?? 0;
    out += withoutSentinels(text.slice(cursor, start));
    out += span[0];
    cursor = start + span[0].length;
  }

  return out + withoutSentinels(text.slice(cursor));
};
