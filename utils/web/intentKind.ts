export const WEB_INTENT_KINDS = [
  'chat',
  'price',
  'specs',
  'comparison',
  'recommendation',
  'news',
  'date',
  'fact',
  'howto',
] as const;

export type WebIntentKind = (typeof WEB_INTENT_KINDS)[number];

const KNOWN_KINDS: ReadonlySet<string> = new Set(WEB_INTENT_KINDS);

export const parseIntentKind = (value: unknown): WebIntentKind | undefined => {
  if (typeof value !== 'string') return undefined;
  const kind = value.trim().toLowerCase();
  return KNOWN_KINDS.has(kind) ? (kind as WebIntentKind) : undefined;
};
