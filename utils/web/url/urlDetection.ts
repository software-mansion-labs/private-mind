const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

export const detectUrls = (input: string): string[] => {
  const matches = input.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;:!?)\]]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
};

export const isSingleUrl = (input: string): boolean => {
  const trimmed = input.trim();
  const urls = detectUrls(trimmed);
  return urls.length === 1 && urls[0] === trimmed;
};
