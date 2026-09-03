import type { ExtractedArticle, StructuredProduct } from '../types';
import {
  URL_FETCH_ACCEPTED_CONTENT_TYPE,
  URL_FETCH_MAX_BYTES,
  URL_FETCH_TIMEOUT_MS,
  URL_FETCH_USER_AGENT,
  WEB_CONTENT_MIN_CHARS,
} from '../../../constants/web';
import { hostname } from '../webResultsToContext';
import {
  assertPublicHttpUrl,
  fetchTextWithLimit,
} from '../security/outboundFetch';

const stripTagBlock = (html: string, tag: string): string =>
  html.replace(
    new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi'),
    ' '
  );

const fromCodePoint = (code: number): string => {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
};

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&');

const META_TAG_PATTERN = /<meta\b[^>]*>/gi;
const META_ATTR_PATTERN =
  /\b(property|name)\s*=\s*["']([^"']+)["']|\bcontent\s*=\s*["']([^"']*)["']/gi;

const extractMetaTags = (html: string): Map<string, string> => {
  const tags = new Map<string, string>();
  for (const tagMatch of html.matchAll(META_TAG_PATTERN)) {
    let key: string | undefined;
    let content: string | undefined;
    for (const attr of tagMatch[0].matchAll(META_ATTR_PATTERN)) {
      if (attr[2] !== undefined) key = attr[2].toLowerCase();
      else content = attr[3];
    }
    if (key !== undefined && content !== undefined && !tags.has(key)) {
      tags.set(key, content);
    }
  }
  return tags;
};

const extractTitle = (
  html: string,
  metaTags: Map<string, string>
): string | undefined => {
  const og = metaTags.get('og:title');
  if (og) return decodeEntities(og).trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeEntities(title[1]).trim() : undefined;
};

const HEADLINE_TAIL_MIN_SHARE = 0.2;

const visibleTextLength = (html: string): number =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;

const cutFromHeadline = (body: string): string => {
  const headline = body.search(/<h1\b/i);
  if (headline < 0) return body;
  const tail = body.slice(headline);
  return visibleTextLength(tail) >=
    visibleTextLength(body) * HEADLINE_TAIL_MIN_SHARE
    ? tail
    : body;
};

const isolateMainContent = (html: string): string => {
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  if (articles.length === 1) return articles[0]!;
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  if (main) return main[0];
  const roleMain = html.match(/<[a-z][^>]*\brole=["']?main\b[\s\S]*/i);
  if (roleMain) return roleMain[0];
  if (articles.length > 1) return articles.join('\n');
  const body = html.match(/<body\b[\s\S]*?<\/body>/i);
  return cutFromHeadline(body ? body[0] : html);
};

const FOOTNOTE_LINE =
  /^(?:[↑^†]|\^)\s|(?:\bArchived from the original\b)|^Retrieved \d|^" ?\. [A-Z]/;
const CITATION_MARKER =
  /\[ ?\d{1,3} ?\]|\[ ?(?:unreliable source\??|citation needed|note \d+) ?[↑]? ?\]/gi;

const dropReferenceLines = (text: string): string =>
  text
    .replace(CITATION_MARKER, ' ')
    .split('\n')
    .filter((line) => !FOOTNOTE_LINE.test(line.trim()))
    .join('\n');

const MENU_RUN_MIN_LINES = 8;
const MENU_LINE_MAX_CHARS = 40;
const MENU_LINE_KEEP = /[\d.!?%°:;]/;

const FACET_COUNT = /\(\s*\d[\d\s.,]*\s*\)/g;
const PROMO_PERCENT = /-?\d+\s*%/g;

const dropMenuRuns = (text: string): string => {
  const lines = text.split('\n');
  const isMenuLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > MENU_LINE_MAX_CHARS) {
      return false;
    }
    const body = trimmed.replace(FACET_COUNT, ' ').replace(PROMO_PERCENT, ' ');
    if (!/\p{L}/u.test(body)) return false;
    return !MENU_LINE_KEEP.test(body);
  };
  const kept: string[] = [];
  for (let start = 0; start < lines.length;) {
    if (!isMenuLine(lines[start]!)) {
      kept.push(lines[start]!);
      start += 1;
      continue;
    }
    let end = start;
    while (end < lines.length && isMenuLine(lines[end]!)) end += 1;
    if (end - start < MENU_RUN_MIN_LINES) {
      kept.push(...lines.slice(start, end));
    }
    start = end;
  }
  return kept.join('\n');
};

const BLOCK_TAG =
  /<(\/?)(p|div|br|li|ul|ol|tr|td|th|table|section|article|h[1-6]|dt|dd|dl|blockquote|pre|figcaption|option|caption)\b[^>]*>/gi;

const VOID_BLOCK_TAGS = new Set(['br']);
const ROW_TAGS = new Set(['tr']);

const CELL_SEPARATOR = ' | ';
const RECORD_MIN_CELLS = 2;
const RECORD_MAX_CELLS = 16;
const RECORD_CELL_MAX_CHARS = 40;
const BLOCK_MAX_DEPTH = 120;

interface BlockFrame {
  tag: string;
  parts: (string | BlockFrame)[];
}

const isBlockFrame = (part: string | BlockFrame): part is BlockFrame =>
  typeof part !== 'string';

const parseBlockFrames = (html: string): BlockFrame => {
  const root: BlockFrame = { tag: 'root', parts: [] };
  const stack: BlockFrame[] = [root];
  let cursor = 0;
  let skipped = 0;

  for (const match of html.matchAll(BLOCK_TAG)) {
    const top = stack[stack.length - 1]!;
    top.parts.push(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const tag = match[2]!.toLowerCase();
    if (VOID_BLOCK_TAGS.has(tag)) {
      top.parts.push('\n');
      continue;
    }
    if (match[1]) {
      if (skipped > 0) skipped -= 1;
      else if (stack.length > 1) stack.pop();
      continue;
    }
    if (stack.length >= BLOCK_MAX_DEPTH) {
      skipped += 1;
      continue;
    }
    const frame: BlockFrame = { tag, parts: [] };
    top.parts.push(frame);
    stack.push(frame);
  }

  stack[stack.length - 1]!.parts.push(html.slice(cursor));
  return root;
};

const flattenToCell = (part: string | BlockFrame): string =>
  (isBlockFrame(part)
    ? part.parts.map(flattenToCell).join(' ')
    : part.replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();

const isLeafFrame = (frame: BlockFrame): boolean =>
  !frame.parts.some(isBlockFrame);

const looksLikeMenuRecord = (record: string): boolean =>
  !MENU_LINE_KEEP.test(
    record.replace(FACET_COUNT, ' ').replace(PROMO_PERCENT, ' ')
  );

const asRecord = (frame: BlockFrame, children: BlockFrame[]): string | null => {
  const cells = children.map(flattenToCell);
  if (cells.some((cell) => cell.length === 0)) return null;
  const record = cells.join(CELL_SEPARATOR);

  if (ROW_TAGS.has(frame.tag)) return record;

  const fitsGrid =
    children.length <= RECORD_MAX_CELLS &&
    children.every(isLeafFrame) &&
    cells.every((cell) => cell.length <= RECORD_CELL_MAX_CHARS);

  return fitsGrid && !looksLikeMenuRecord(record) ? record : null;
};

const renderBlockFrame = (frame: BlockFrame): string => {
  const children = frame.parts.filter(isBlockFrame);
  const ownText = frame.parts
    .filter((part): part is string => !isBlockFrame(part))
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .trim();

  if (children.length >= RECORD_MIN_CELLS && ownText.length === 0) {
    const record = asRecord(frame, children);
    if (record !== null) return record;
  }

  return frame.parts
    .map((part) => (isBlockFrame(part) ? renderBlockFrame(part) : part))
    .join('\n');
};

export const groupBlockRecords = (html: string): string =>
  renderBlockFrame(parseBlockFrames(html));

const heuristicExtractText = (html: string): string => {
  let out = html
    .replace(/\sdata-mw=(["'])[\s\S]*?\1/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'noscript',
    'svg',
    'template',
  ]) {
    out = stripTagBlock(out, tag);
  }
  out = isolateMainContent(out);
  const normalized = decodeEntities(
    groupBlockRecords(out).replace(/<[^>]+>/g, ' ')
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n');
  return dropMenuRuns(dropReferenceLines(normalized)).trim();
};

const JSON_LD_PATTERN =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const JSON_LD_TEXT_KEYS = [
  'articleBody',
  'description',
  'text',
  'headline',
] as const;

const JSON_LD_MAX_PARTS = 40;
const JSON_LD_MAX_DEPTH = 6;

const collectJsonLdText = (html: string): string => {
  const parts: string[] = [];

  const visit = (node: unknown, depth: number): void => {
    if (depth > JSON_LD_MAX_DEPTH || parts.length >= JSON_LD_MAX_PARTS) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    for (const key of JSON_LD_TEXT_KEYS) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) parts.push(value.trim());
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };

  for (const match of html.matchAll(JSON_LD_PATTERN)) {
    try {
      visit(JSON.parse(match[1]!), 0);
    } catch {
      continue;
    }
  }

  return [...new Set(parts)].join(' ').replace(/\s+/g, ' ').trim();
};

const AVAILABILITY_LABELS: Record<string, string> = {
  instock: 'in stock',
  outofstock: 'out of stock',
  preorder: 'pre-order',
  discontinued: 'discontinued',
  limitedavailability: 'limited availability',
  soldout: 'sold out',
  backorder: 'back order',
  onlineonly: 'online only',
  instorenow: 'available in store',
};

const normalizeAvailability = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const slug = raw
    .replace(/^https?:\/\/schema\.org\//i, '')
    .toLowerCase()
    .trim();
  return AVAILABILITY_LABELS[slug];
};

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const typeIncludes = (node: Record<string, unknown>, type: string): boolean =>
  asArray(node['@type'] as string | string[] | undefined).some(
    (candidate) =>
      typeof candidate === 'string' &&
      candidate.toLowerCase() === type.toLowerCase()
  );

interface ParsedOffer {
  price?: string;
  currency?: string;
  availability?: string;
}

const parseOfferNode = (node: unknown): ParsedOffer | null => {
  if (!node || typeof node !== 'object') return null;
  const offer = node as Record<string, unknown>;
  const rawPrice = offer.price ?? offer.lowPrice;
  const price =
    typeof rawPrice === 'string' || typeof rawPrice === 'number'
      ? String(rawPrice).trim()
      : undefined;
  const currency =
    typeof offer.priceCurrency === 'string' ? offer.priceCurrency : undefined;
  const availability = normalizeAvailability(offer.availability);
  if (!price && !currency && !availability) return null;
  return { price, currency, availability };
};

const JSON_LD_PRODUCT_MAX_DEPTH = 6;

const collectProductNodes = (html: string): Record<string, unknown>[] => {
  const products: Record<string, unknown>[] = [];
  const visit = (node: unknown, depth: number): void => {
    if (depth > JSON_LD_PRODUCT_MAX_DEPTH) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeIncludes(record, 'Product')) products.push(record);
    if (record['@graph'] !== undefined) visit(record['@graph'], depth + 1);
  };

  for (const match of html.matchAll(JSON_LD_PATTERN)) {
    try {
      visit(JSON.parse(match[1]!), 0);
    } catch {
      continue;
    }
  }
  return products;
};

const extractJsonLdProduct = (html: string): StructuredProduct | undefined => {
  const products = collectProductNodes(html);
  if (products.length !== 1) return undefined;

  const product = products[0]!;
  const name =
    typeof product.name === 'string' ? product.name.trim() : undefined;

  const offers = asArray(product.offers as unknown)
    .map(parseOfferNode)
    .filter((offer): offer is ParsedOffer => offer !== null);
  const distinctPrices = new Set(
    offers
      .map((offer) => offer.price)
      .filter((price): price is string => !!price)
  );
  if (distinctPrices.size > 1) {
    return name ? { name } : undefined;
  }

  const offer = offers[0];
  if (!name && !offer) return undefined;
  return {
    name,
    price: offer?.price,
    currency: offer?.currency,
    availability: offer?.availability,
  };
};

const extractOpenGraphProduct = (
  metaTags: Map<string, string>
): StructuredProduct | undefined => {
  const amount = metaTags.get('product:price:amount')?.trim();
  if (!amount) return undefined;
  return {
    price: amount,
    currency: metaTags.get('product:price:currency')?.trim(),
  };
};

const declaresNonProductPage = (metaTags: Map<string, string>): boolean => {
  const type = metaTags.get('og:type')?.trim().toLowerCase();
  return !!type && type !== 'product' && !type.startsWith('product.');
};

const extractStructuredProductFromMeta = (
  html: string,
  metaTags: Map<string, string>
): StructuredProduct | undefined => {
  if (declaresNonProductPage(metaTags)) return undefined;
  return extractJsonLdProduct(html) ?? extractOpenGraphProduct(metaTags);
};

export const extractStructuredProduct = (
  html: string
): StructuredProduct | undefined =>
  extractStructuredProductFromMeta(html, extractMetaTags(html));

const extractMetaDescription = (metaTags: Map<string, string>): string =>
  decodeEntities(
    metaTags.get('og:description') ?? metaTags.get('description') ?? ''
  ).trim();

const BOT_WALL_PHRASES =
  /are you a robot|unusual traffic|verify you are human|verify you're human|checking your browser|enable javascript and cookies|just a moment|attention required|access denied|request blocked|pardon our interruption/i;

const BOT_WALL_MAX_TEXT_CHARS = 800;

const CHALLENGE_MARKERS =
  /cf-browser-verification|id=["']challenge-(?:form|running)|id=["']cf-challenge-running|(?:src|action)=["'][^"']*(?:recaptcha|hcaptcha|turnstile|challenge)|id=["']captcha/i;

export const hasChallengeMarkers = (html: string): boolean =>
  CHALLENGE_MARKERS.test(html);

export const looksLikeBotWall = (text: string, title?: string): boolean => {
  if (title && BOT_WALL_PHRASES.test(title)) return true;
  return text.length < BOT_WALL_MAX_TEXT_CHARS && BOT_WALL_PHRASES.test(text);
};

export const fetchHtml = async (
  url: string,
  timeoutMs: number = URL_FETCH_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<string> => {
  assertPublicHttpUrl(url);
  return fetchTextWithLimit(url, {
    timeoutMs,
    signal,
    headers: { 'User-Agent': URL_FETCH_USER_AGENT, 'Accept': 'text/html' },
    maxBytes: URL_FETCH_MAX_BYTES,
    contentTypePattern: URL_FETCH_ACCEPTED_CONTENT_TYPE,
  });
};

export const extractArticle = async (
  url: string,
  timeoutMs?: number,
  signal?: AbortSignal
): Promise<ExtractedArticle> => {
  const html = await fetchHtml(url, timeoutMs, signal);
  const metaTags = extractMetaTags(html);
  const title = extractTitle(html, metaTags) ?? hostname(url);
  const product = extractStructuredProductFromMeta(html, metaTags);

  let text = heuristicExtractText(html);
  if (text.length < WEB_CONTENT_MIN_CHARS) {
    const structured = [
      collectJsonLdText(html),
      extractMetaDescription(metaTags),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (structured.length > text.length) text = structured;
  }

  if (hasChallengeMarkers(html) && text.length < BOT_WALL_MAX_TEXT_CHARS) {
    return { url, title, text: '', siteName: hostname(url) };
  }

  return { url, title, text, siteName: hostname(url), product };
};
