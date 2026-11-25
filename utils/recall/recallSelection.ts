import { estimatePromptTokens } from '../../constants/context-window';
import {
  RECALL_BLOCK_HEADER,
  RECALL_MAX_HITS,
  RECALL_MIN_KEPT_SHARE,
  RECALL_MIN_LEXICAL_SCORE,
  RECALL_MIN_SIMILARITY,
  RECALL_SHARE_BY_WINDOW,
} from '../../constants/conversation-memory';
import { reciprocalRankFusion } from '../rankFusion';
import { bestWindow, questionTermsFor } from './recallTerms';

export type RecallRole = 'user' | 'assistant';
export type RecallMode = 'none' | 'lexical' | 'fused';

export interface RecallCandidate {
  index: number;
  key?: number;
  role: RecallRole;
  text: string;
}

export interface RecalledMessage {
  index: number;
  role: RecallRole;
  text: string;
  rank: number;
  partner: boolean;
}

export interface RecallSelection {
  items: RecalledMessage[];
  mode: RecallMode;
}

export interface RecallInput {
  candidates: RecallCandidate[];
  question: string;
  similarities?: Map<number, number>;
  charRoom: number;
  tokenRoom: number;
}

export const recallShareFor = (windowTokens: number): number =>
  Math.min(
    RECALL_SHARE_BY_WINDOW.find((tier) => windowTokens >= tier.minWindowTokens)
      ?.share ?? 0,
    1 - RECALL_MIN_KEPT_SHARE
  );

const roleLabel = (role: RecallRole): string =>
  role === 'user' ? 'User' : 'Assistant';

const lineOf = (role: RecallRole, text: string): string =>
  `${roleLabel(role)}: ${text}`;

export const formatRecalledBlock = (items: RecalledMessage[]): string =>
  items.length === 0
    ? ''
    : `${RECALL_BLOCK_HEADER}${items
        .map((item) => lineOf(item.role, item.text))
        .join('\n')}`;

const partnerOf = (
  hit: RecallCandidate,
  byIndex: Map<number, RecallCandidate>
): RecallCandidate | undefined => {
  if (hit.role === 'user') {
    const reply = byIndex.get(hit.index + 1);
    return reply?.role === 'assistant' ? reply : undefined;
  }
  const question = byIndex.get(hit.index - 1);
  return question?.role === 'user' ? question : undefined;
};

export const selectRecalledMessages = ({
  candidates,
  question,
  similarities,
  charRoom,
  tokenRoom,
}: RecallInput): RecallSelection => {
  const none: RecallSelection = { items: [], mode: 'none' };
  const roomAfterHeader = charRoom - RECALL_BLOCK_HEADER.length;
  if (candidates.length === 0 || roomAfterHeader <= 0 || tokenRoom <= 0) {
    return none;
  }

  const terms = questionTermsFor(question);
  const scored = candidates.map((candidate) => {
    const window = bestWindow(candidate.text, terms);
    const similarity =
      candidate.key === undefined
        ? undefined
        : similarities?.get(candidate.key);
    return { candidate, window, similarity };
  });
  const usesEmbeddings = !!similarities && similarities.size > 0;

  const qualified = scored.filter(
    ({ window, similarity }) =>
      window.score >= RECALL_MIN_LEXICAL_SCORE ||
      (similarity !== undefined && similarity >= RECALL_MIN_SIMILARITY)
  );
  if (qualified.length === 0) return none;

  const newestFirst = (a: { candidate: RecallCandidate }, b: typeof a) =>
    b.candidate.index - a.candidate.index;
  const lexicalRanked = qualified
    .filter(({ window }) => window.score > 0)
    .sort((a, b) => b.window.score - a.window.score || newestFirst(a, b));
  const vectorRanked = qualified
    .filter(({ similarity }) => similarity !== undefined)
    .sort(
      (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || newestFirst(a, b)
    );
  const fused = reciprocalRankFusion([
    { ids: lexicalRanked.map(({ candidate }) => String(candidate.index)) },
    { ids: vectorRanked.map(({ candidate }) => String(candidate.index)) },
  ]);
  const ranked = [...qualified].sort(
    (a, b) =>
      (fused.get(String(b.candidate.index)) ?? 0) -
        (fused.get(String(a.candidate.index)) ?? 0) || newestFirst(a, b)
  );

  const textByIndex = new Map(
    scored.map(({ candidate, window }) => [candidate.index, window.text])
  );
  const byIndex = new Map(
    candidates.map((candidate) => [candidate.index, candidate])
  );
  const chosen = new Map<number, RecalledMessage>();
  let charsLeft = roomAfterHeader;
  let tokensLeft = tokenRoom;

  const tryAdd = (
    candidate: RecallCandidate,
    rank: number,
    partner: boolean
  ): boolean => {
    if (chosen.has(candidate.index)) return false;
    const line = lineOf(
      candidate.role,
      textByIndex.get(candidate.index) ?? candidate.text
    );
    const chars = line.length + 1;
    const tokens = estimatePromptTokens(line);
    if (chars > charsLeft || tokens > tokensLeft) return false;
    charsLeft -= chars;
    tokensLeft -= tokens;
    chosen.set(candidate.index, {
      index: candidate.index,
      role: candidate.role,
      text: textByIndex.get(candidate.index) ?? candidate.text,
      rank,
      partner,
    });
    return true;
  };

  const hits: RecallCandidate[] = [];
  for (const { candidate } of ranked) {
    if (hits.length >= RECALL_MAX_HITS) break;
    if (tryAdd(candidate, hits.length, false)) hits.push(candidate);
  }
  hits.forEach((hit, rank) => {
    const partner = partnerOf(hit, byIndex);
    if (partner) tryAdd(partner, rank, true);
  });

  const items = [...chosen.values()].sort((a, b) => a.index - b.index);
  return items.length === 0
    ? none
    : { items, mode: usesEmbeddings ? 'fused' : 'lexical' };
};

export const withoutLeastRanked = (
  items: RecalledMessage[]
): RecalledMessage[] => {
  if (items.length === 0) return items;
  const worst = Math.max(...items.map((item) => item.rank));
  const partnerAt = items.findIndex(
    (item) => item.rank === worst && item.partner
  );
  const dropIndex =
    partnerAt >= 0 ? partnerAt : items.findIndex((item) => item.rank === worst);
  return items.filter((_, position) => position !== dropIndex);
};
