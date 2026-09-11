export interface HtmlTag {
  name: string;
  closing: boolean;
  start: number;
  end: number;
}

const isNameStart = (code: number): boolean =>
  (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

const isNameChar = (code: number): boolean =>
  isNameStart(code) ||
  (code >= 48 && code <= 57) ||
  code === 45 ||
  code === 58 ||
  code === 95;

const QUOTE_DOUBLE = 34;
const QUOTE_SINGLE = 39;
const GREATER_THAN = 62;
const SLASH = 47;
const BANG = 33;
const QUESTION = 63;

const tagEnd = (html: string, from: number): number => {
  for (let at = from; at < html.length; at++) {
    const code = html.charCodeAt(at);
    if (code === GREATER_THAN) return at + 1;
    if (code === QUOTE_DOUBLE || code === QUOTE_SINGLE) {
      const close = html.indexOf(html[at]!, at + 1);
      if (close === -1) return html.length;
      at = close;
    }
  }
  return html.length;
};

const markupEnd = (html: string, start: number): number => {
  if (html.startsWith('<!--', start)) {
    const close = html.indexOf('-->', start + 4);
    return close === -1 ? html.length : close + 3;
  }
  const close = html.indexOf('>', start);
  return close === -1 ? html.length : close + 1;
};

export const scanTags = (html: string): HtmlTag[] => {
  const tags: HtmlTag[] = [];
  let at = html.indexOf('<');
  while (at !== -1 && at < html.length - 1) {
    const next = html.charCodeAt(at + 1);
    if (next === BANG || next === QUESTION) {
      const end = markupEnd(html, at);
      tags.push({ name: '', closing: false, start: at, end });
      at = html.indexOf('<', end);
      continue;
    }
    const closing = next === SLASH;
    const nameStart = closing ? at + 2 : at + 1;
    if (!isNameStart(html.charCodeAt(nameStart))) {
      at = html.indexOf('<', at + 1);
      continue;
    }
    let nameEnd = nameStart + 1;
    while (nameEnd < html.length && isNameChar(html.charCodeAt(nameEnd))) {
      nameEnd += 1;
    }
    const end = tagEnd(html, nameEnd);
    tags.push({
      name: html.slice(nameStart, nameEnd).toLowerCase(),
      closing,
      start: at,
      end,
    });
    at = html.indexOf('<', end);
  }
  return tags;
};

export const stripTags = (html: string): string => {
  const tags = scanTags(html);
  if (tags.length === 0) return html;
  const parts: string[] = [];
  let cursor = 0;
  for (const tag of tags) {
    parts.push(html.slice(cursor, tag.start));
    cursor = tag.end;
  }
  parts.push(html.slice(cursor));
  return parts.join(' ');
};

const closingTagIndex = (lower: string, name: string, from: number): number => {
  let at = lower.indexOf(`</${name}`, from);
  while (at !== -1) {
    const after = lower.charCodeAt(at + 2 + name.length);
    if (Number.isNaN(after) || !isNameChar(after)) return at;
    at = lower.indexOf(`</${name}`, at + 1);
  }
  return -1;
};

interface Removal {
  start: number;
  end: number;
}

const rawTextRemoval = (html: string, lower: string, tag: HtmlTag): Removal => {
  const close = closingTagIndex(lower, tag.name, tag.end);
  if (close === -1) return { start: tag.start, end: html.length };
  return { start: tag.start, end: tagEnd(html, close + 2 + tag.name.length) };
};

export const removeElements = (
  html: string,
  nested: ReadonlySet<string>,
  rawText: ReadonlySet<string>
): string => {
  const tags = scanTags(html);
  const lower = html.toLowerCase();
  const removals: Removal[] = [];
  const open = new Map<string, { depth: number; start: number }>();
  let skipUntil = 0;

  for (const tag of tags) {
    if (tag.start < skipUntil) continue;
    if (!tag.closing && rawText.has(tag.name)) {
      const removal = rawTextRemoval(html, lower, tag);
      removals.push(removal);
      skipUntil = removal.end;
      continue;
    }
    if (!nested.has(tag.name)) continue;
    const state = open.get(tag.name);
    if (!tag.closing) {
      if (!state) open.set(tag.name, { depth: 1, start: tag.start });
      else state.depth += 1;
      continue;
    }
    if (!state) continue;
    state.depth -= 1;
    if (state.depth === 0) {
      removals.push({ start: state.start, end: tag.end });
      open.delete(tag.name);
    }
  }

  if (removals.length === 0) return html;
  removals.sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;
  for (const removal of removals) {
    if (removal.start < cursor) continue;
    parts.push(html.slice(cursor, removal.start), ' ');
    cursor = removal.end;
  }
  parts.push(html.slice(cursor));
  return parts.join('');
};

export const elementSlices = (html: string, name: string): string[] => {
  const slices: string[] = [];
  let depth = 0;
  let start = 0;
  for (const tag of scanTags(html)) {
    if (tag.name !== name) continue;
    if (!tag.closing) {
      if (depth === 0) start = tag.start;
      depth += 1;
      continue;
    }
    if (depth === 0) continue;
    depth -= 1;
    if (depth === 0) slices.push(html.slice(start, tag.end));
  }
  return slices;
};

export const rawTextContents = (
  html: string,
  name: string,
  accept: (openTag: string) => boolean
): string[] => {
  const contents: string[] = [];
  const lower = html.toLowerCase();
  let skipUntil = 0;
  for (const tag of scanTags(html)) {
    if (tag.start < skipUntil || tag.closing || tag.name !== name) continue;
    const close = closingTagIndex(lower, name, tag.end);
    if (close === -1) break;
    if (accept(html.slice(tag.start, tag.end))) {
      contents.push(html.slice(tag.end, close));
    }
    skipUntil = tagEnd(html, close + 2 + name.length);
  }
  return contents;
};

export const openTags = (html: string, name: string): string[] =>
  scanTags(html)
    .filter((tag) => !tag.closing && tag.name === name)
    .map((tag) => html.slice(tag.start, tag.end));
