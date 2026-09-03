import type { SourceDocument } from '../database/chatRepository';
import { sourceKind } from '../database/chatRepository';
import {
  CITATION_MIN_MATCH_SCORE,
  CITATION_SENTENCE_PATTERN,
} from '../constants/citations';
import { extractQueryTerms, stemPrefix } from './queryTerms';
import { outsideThinkSegments } from './thinking';

export interface AttributedBlock {
  text: string;
  source: SourceDocument | null;
}

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const FENCE = /^\s*```/;
const HEADING = /^\s*#{1,6}\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

const stemsOf = (text: string): Set<string> =>
  new Set([...extractQueryTerms(text)].map(stemPrefix));

const overlap = (haystack: Set<string>, needles: Set<string>): number => {
  let hits = 0;
  for (const stem of needles) {
    if (haystack.has(stem)) hits += 1;
  }
  return hits;
};

export const splitIntoBlocks = (text: string): string[] => {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;

  const flush = () => {
    const joined = current.join('\n').trim();
    if (joined) blocks.push(joined);
    current = [];
  };

  for (const line of lines) {
    if (FENCE.test(line)) {
      if (fenced) {
        current.push(line);
        fenced = false;
        flush();
      } else {
        flush();
        fenced = true;
        current.push(line);
      }
      continue;
    }
    if (fenced) {
      current.push(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const startsStructure =
      LIST_ITEM.test(line) || HEADING.test(line) || TABLE_ROW.test(line);
    const inStructure =
      current.length > 0 &&
      (LIST_ITEM.test(current[0]!) ||
        HEADING.test(current[0]!) ||
        TABLE_ROW.test(current[0]!));
    if (startsStructure && current.length > 0 && !inStructure) flush();
    if (!startsStructure && inStructure) flush();
    current.push(line);
  }
  if (fenced) flush();
  else flush();
  return blocks;
};

const sentencesOf = (block: string): string[] => {
  const matched = block.match(CITATION_SENTENCE_PATTERN) ?? [block];
  return matched.map((sentence) => sentence.trim()).filter(Boolean);
};

const bestSourceFor = (
  sentence: string,
  sourceStems: Set<string>[]
): number | null => {
  const stems = stemsOf(sentence);
  if (stems.size === 0) return null;
  let bestIndex: number | null = null;
  let bestScore = 0;
  sourceStems.forEach((haystack, index) => {
    const score = overlap(haystack, stems);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= CITATION_MIN_MATCH_SCORE ? bestIndex : null;
};

export const attributeSourcesByBlock = (
  answer: string,
  sources: SourceDocument[]
): AttributedBlock[] => {
  const visible = outsideThinkSegments(answer).join('\n').trim();
  if (!visible) return [];
  const usable = sources.filter(
    (source) => sourceKind(source) === 'web' && source.used !== false
  );
  const blocks = splitIntoBlocks(visible);
  if (usable.length === 0) {
    return blocks.map((text) => ({ text, source: null }));
  }

  const sourceStems = usable.map((source) =>
    stemsOf(`${source.name} ${source.passage ?? ''}`)
  );

  let carried: number | null = null;
  const attributed = blocks.map((text) => {
    const votes = new Map<number, number>();
    for (const sentence of sentencesOf(text)) {
      const index = bestSourceFor(sentence, sourceStems);
      if (index === null) continue;
      votes.set(index, (votes.get(index) ?? 0) + 1);
    }
    let winner: number | null = null;
    let best = 0;
    for (const [index, count] of votes) {
      if (count > best) {
        best = count;
        winner = index;
      }
    }
    if (winner === null) winner = carried;
    else carried = winner;
    return { text, index: winner };
  });

  const merged: AttributedBlock[] = [];
  for (const block of attributed) {
    const previous = merged.at(-1);
    const source = block.index === null ? null : usable[block.index]!;
    if (previous && previous.source === source) {
      merged[merged.length - 1] = {
        text: `${previous.text}\n\n${block.text}`,
        source,
      };
      continue;
    }
    merged.push({ text: block.text, source });
  }
  return merged;
};
