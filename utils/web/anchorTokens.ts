const ANCHOR_TAIL = /^[\p{Lu}\p{Lt}][\p{L}\p{N}'’-]*$/u;
const HAS_DIGIT = /\p{N}/u;

export const anchorTokens = (query: string): string[] => {
  const raw = query.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
  return raw.filter((token, index) => {
    if (HAS_DIGIT.test(token)) return true;
    return index > 0 && ANCHOR_TAIL.test(token) && token.length >= 2;
  });
};
