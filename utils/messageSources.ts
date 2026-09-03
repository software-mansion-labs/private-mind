import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import {
  SourceDocument,
  sourceKind,
  type GroundingCaveatKind,
} from '../database/chatRepository';
import {
  formatContextChunks,
  formatFirstChunks,
  getSourceDocumentsFromChunks,
  sourceKey,
  sourcesPresentInContext,
} from './contextUtils';
import { hybridRetrieve } from './hybridRetrieval';
import { extractQueryTerms, foldForMatching, stemPrefix } from './queryTerms';
import {
  findUngroundedFigures,
  isUngroundedConversionClaim,
  isUngroundedTrendClaim,
} from './web/figureGrounding';
import { carryReferentIntoQuery } from './web/buildSearchQuery';
import type { WebIntentKind } from './web/intentKind';
import { ANSWER_CITATION_OVERLAP_RATIO } from '../constants/retrieval';
import {
  CITATION_SENTENCE_PATTERN,
  CLAUSE_SPLIT_PATTERN,
  NEGATION_CUE_EN,
  NO_ANSWER_PATTERNS_EN,
  NO_ANSWER_PATTERNS_PL,
} from '../constants/citations';
import { outsideThinkSegments, stripThinkBlocks } from './thinking';
import { detectQuestionLanguage } from './questionLanguage';

export interface SourceRow {
  id: number;
  name: string;
  type?: string;
  firstChunk?: string;
}

const getAttachmentSourceDocuments = (
  sources: SourceRow[],
  attachmentSourceIds: number[]
): SourceDocument[] =>
  sources
    .filter((source) => attachmentSourceIds.includes(source.id))
    .map((source) => ({
      documentId: source.id,
      name: source.name,
      passage: source.firstChunk,
    }));

export const mergeAttachmentFirst = (
  retrieved: SourceDocument[],
  preferred: SourceDocument[],
  attachmentSourceIds: number[]
): SourceDocument[] => {
  const attachmentIds = new Set(attachmentSourceIds);
  const isAttachment = (doc: SourceDocument) =>
    doc.documentId !== undefined && attachmentIds.has(doc.documentId);

  const attachmentDocs = retrieved.filter(isAttachment);
  const otherDocs = retrieved.filter((doc) => !isAttachment(doc));

  const citedKeys = new Set(
    attachmentDocs.map((doc) => sourceKey(doc.documentId, doc.name))
  );
  const missingAttachments = preferred.filter(
    (doc) => !citedKeys.has(sourceKey(doc.documentId, doc.name))
  );

  return [...attachmentDocs, ...missingAttachments, ...otherDocs];
};

export const assembleSourceDocuments = (
  retrieved: SourceDocument[],
  preferred: SourceDocument[],
  attachmentSourceIds: number[],
  activeSources: SourceRow[],
  contextPresent: boolean
): SourceDocument[] => {
  const merged = mergeAttachmentFirst(
    retrieved,
    preferred,
    attachmentSourceIds
  );
  if (merged.length > 0 || !contextPresent) return merged;

  return activeSources.map((source) => ({
    documentId: source.id,
    name: source.name,
    passage: source.firstChunk,
  }));
};

export const restrictCitationsToContext = (
  sourceDocuments: SourceDocument[],
  promptContext: string,
  preferred: SourceDocument[]
): SourceDocument[] => {
  if (sourceDocuments.length <= 1) return sourceDocuments;

  const present = sourcesPresentInContext(promptContext);
  const preferredNames = new Set(preferred.map((doc) => doc.name));

  const survived = sourceDocuments.filter(
    (doc) =>
      sourceKind(doc) === 'web' ||
      preferredNames.has(doc.name) ||
      present.has(doc.name)
  );
  return survived.length > 0 ? survived : sourceDocuments.slice(0, 1);
};

const overlapWithAnswer = (
  passage: string,
  answerTerms: Set<string>
): number => {
  let overlap = 0;
  const seen = new Set<string>();
  for (const term of extractQueryTerms(passage)) {
    const stem = stemPrefix(term);
    if (seen.has(stem)) continue;
    seen.add(stem);
    if (answerTerms.has(stem)) overlap++;
  }
  return overlap;
};

// Attribute against the visible reply only; the <think> block surveys every source and inflates overlap.
export const visibleAnswer = (answer: string): string =>
  outsideThinkSegments(answer).join(' ');

const affirmativeAnswer = (visibleReply: string): string =>
  (visibleReply.match(CITATION_SENTENCE_PATTERN) ?? [visibleReply])
    .flatMap((sentence) => sentence.split(CLAUSE_SPLIT_PATTERN))
    .filter((clause) => clause && !NEGATION_CUE_EN.test(clause))
    .join(' ');

const answerTermsOf = (answer: string): Set<string> =>
  new Set(
    [...extractQueryTerms(affirmativeAnswer(visibleAnswer(answer)))].map(
      stemPrefix
    )
  );

export const looksLikeNoAnswer = (visibleReply: string): boolean =>
  [...NO_ANSWER_PATTERNS_EN, ...NO_ANSWER_PATTERNS_PL].some((pattern) =>
    pattern.test(visibleReply)
  );

export const answerCitationOverlaps = (
  sourceDocuments: SourceDocument[],
  answer: string
): string[] => {
  const answerTerms = answerTermsOf(answer);
  return sourceDocuments.map(
    (doc) =>
      `${doc.name}:${overlapWithAnswer(`${doc.name} ${doc.passage ?? ''}`, answerTerms)}`
  );
};

const SOURCE_REFERENCE =
  /(?<![\p{L}\p{N}])(?:sources?|źród[łl]\w*)\s*(\d+)\b/giu;

export const humanizeSourceReferences = (
  answer: string,
  sourceDocuments: SourceDocument[]
): string => {
  if (sourceDocuments.length === 0) return answer;
  return answer.replace(SOURCE_REFERENCE, (match, numeral: string) => {
    const doc = sourceDocuments[Number(numeral) - 1];
    return doc ? doc.name : match;
  });
};

export const detectGroundingCaveats = (
  answer: string,
  question: string | undefined,
  context: string,
  priorAnswerText?: string
): GroundingCaveatKind[] => {
  const caveats: GroundingCaveatKind[] = [];
  if (findUngroundedFigures(answer, context).length > 0) {
    caveats.push('figure');
  }
  if (isUngroundedTrendClaim(answer, question, context)) {
    caveats.push('trend');
  }
  if (isUngroundedConversionClaim(answer, question, context, priorAnswerText)) {
    caveats.push('conversion');
  }
  return caveats;
};

const normalizeForEchoCompare = (text: string): string =>
  foldForMatching(text.trim())
    .replace(/[?!.,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripTrailingParenthetical = (text: string): string =>
  text.replace(/\s*\([^)]{0,80}\)\s*$/, '');

export const isQuestionEchoAnswer = (
  answer: string,
  question: string | undefined
): boolean => {
  if (!question) return false;
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  const normalizedQuestion = normalizeForEchoCompare(question);
  if (normalizeForEchoCompare(visible) === normalizedQuestion) return true;
  const answerWithoutAnchor = normalizeForEchoCompare(
    stripTrailingParenthetical(visible)
  );
  return answerWithoutAnchor === normalizedQuestion;
};

const THINK_PREFIX = /^\s*(?:<think>[\s\S]*?<\/think>)?\s*/;
const ECHO_PREFIX_TRAILER = /^[\s?!.:,;–—-]+/;

const ANSWER_LABEL = /^\s*(?:odpowied[źz]|answer)\s*[:：-]\s*/i;
const RESTATED_QUESTION_OVERLAP = 0.8;

const stemSet = (text: string): Set<string> =>
  new Set([...extractQueryTerms(text)].map(stemPrefix));

const restatesQuestion = (line: string, question: string): boolean => {
  const asked = stemSet(question);
  const written = stemSet(line);
  if (asked.size === 0 || written.size === 0) return false;
  let shared = 0;
  for (const stem of written) {
    if (asked.has(stem)) shared += 1;
  }
  return shared / written.size >= RESTATED_QUESTION_OVERLAP;
};

const startsLikeSentence = (text: string): boolean =>
  /^[\p{Lu}\p{N}"'„«\-*#]/u.test(text.trim());

export const stripEchoedQuestionPrefix = (
  answer: string,
  question: string | undefined
): string => {
  const asked = question?.trim().replace(/[?!.]+$/, '');
  if (!asked) return answer;
  const head = answer.match(THINK_PREFIX)?.[0] ?? '';
  let rest = answer.slice(head.length);

  if (rest.toLowerCase().startsWith(asked.toLowerCase())) {
    const remainder = rest.slice(asked.length).replace(ECHO_PREFIX_TRAILER, '');
    if (!remainder.trim()) return answer;
    rest = remainder;
  }

  for (let guard = 0; guard < 3; guard++) {
    const opener = rest.match(/^[^\n?]*\?/)?.[0] ?? '';
    const openerTail = rest.slice(opener.length);
    const openerRemainder = openerTail.replace(/^[\s\n]+/, '');
    if (
      opener.trim() &&
      restatesQuestion(opener, asked) &&
      startsLikeSentence(openerRemainder)
    ) {
      rest = openerRemainder;
      continue;
    }
    const [firstLine = '', ...others] = rest.split('\n');
    const label = firstLine.trim();
    const rowTail = others.join('\n');
    if (
      rowTail.trim() &&
      ANSWER_LABEL.test(label) &&
      label.replace(ANSWER_LABEL, '').trim() === ''
    ) {
      rest = rowTail.replace(/^\n+/, '');
      continue;
    }
    break;
  }

  const cleaned = rest.replace(ANSWER_LABEL, '');
  return startsLikeSentence(cleaned) ? `${head}${cleaned}` : answer;
};

const DANGLING_LIST_INTRO = /[:：]\s*$/;
const DANGLING_LIST_MARKER_ONLY = /^\s*(?:\d+[.)]|[-*•])\s*$/;

export const isDanglingListAnswer = (answer: string): boolean => {
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  if (DANGLING_LIST_INTRO.test(visible)) return true;
  const lastLine = visible.split('\n').at(-1) ?? '';
  return DANGLING_LIST_MARKER_ONLY.test(lastLine);
};

const CIRCULAR_SOURCE_REFERENCE_THRESHOLD = 3;
const SOURCE_REFERENCE_MARKER = /źród\w*|\bsources?\b/giu;

export const isCircularNonAnswer = (answer: string): boolean => {
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  const withoutCitations = visible.replace(SOURCE_REFERENCE, ' ');
  const mentions = withoutCitations.match(SOURCE_REFERENCE_MARKER)?.length ?? 0;
  return mentions >= CIRCULAR_SOURCE_REFERENCE_THRESHOLD;
};

export const isWrongLanguageAnswer = (
  answer: string,
  question: string | undefined
): boolean => {
  if (!question) return false;
  const expected = detectQuestionLanguage(question);
  if (!expected) return false;
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  const actual = detectQuestionLanguage(visible);
  return !!actual && actual.code !== expected.code;
};

export const pickCitationsByAnswer = (
  sourceDocuments: SourceDocument[],
  answer: string,
  preferred: SourceDocument[],
  presentNames?: Set<string>
): SourceDocument[] => {
  const webDocuments = sourceDocuments.filter(
    (doc) => sourceKind(doc) === 'web'
  );
  const localDocuments = sourceDocuments.filter(
    (doc) => sourceKind(doc) === 'document'
  );
  const citedLocal = pickLocalCitationsByAnswer(
    localDocuments,
    answer,
    preferred
  );
  return [
    ...citedLocal,
    ...flagUsedWebDocuments(webDocuments, answer, presentNames),
  ];
};

const flagUsedWebDocuments = (
  webDocuments: SourceDocument[],
  answer: string,
  presentNames?: Set<string>
): SourceDocument[] => {
  if (webDocuments.length === 0) return webDocuments;

  const answerTerms = answerTermsOf(answer);
  if (answerTerms.size === 0 || looksLikeNoAnswer(visibleAnswer(answer))) {
    return webDocuments.map((doc) => ({ ...doc, used: false }));
  }

  const scored = webDocuments.map((doc) => ({
    doc,
    overlap: overlapWithAnswer(`${doc.name} ${doc.passage ?? ''}`, answerTerms),
  }));
  const maxOverlap = Math.max(0, ...scored.map((s) => s.overlap));
  const isPresent = (doc: SourceDocument) =>
    presentNames === undefined || presentNames.has(doc.name);

  if (maxOverlap === 0) {
    return scored.map((s) => ({ ...s.doc, used: isPresent(s.doc) }));
  }

  return scored.map((s) => ({
    ...s.doc,
    used:
      s.overlap >= maxOverlap * ANSWER_CITATION_OVERLAP_RATIO &&
      isPresent(s.doc),
  }));
};

const pickLocalCitationsByAnswer = (
  sourceDocuments: SourceDocument[],
  answer: string,
  preferred: SourceDocument[]
): SourceDocument[] => {
  if (looksLikeNoAnswer(visibleAnswer(answer))) {
    return [];
  }

  if (sourceDocuments.length <= 1) return sourceDocuments;

  const preferredNames = new Set(preferred.map((doc) => doc.name));

  const answerTerms = answerTermsOf(answer);
  const scored = sourceDocuments.map((doc) => ({
    doc,
    isPreferred: preferredNames.has(doc.name),
    overlap: answerTerms.size
      ? overlapWithAnswer(`${doc.name} ${doc.passage ?? ''}`, answerTerms)
      : 0,
  }));

  const maxOverlap = Math.max(0, ...scored.map((s) => s.overlap));

  if (maxOverlap === 0) {
    return scored.filter((s) => s.isPreferred).map((s) => s.doc);
  }

  return scored
    .filter(
      (s) =>
        s.isPreferred || s.overlap >= maxOverlap * ANSWER_CITATION_OVERLAP_RATIO
    )
    .map((s) => s.doc);
};

const retrieveChunks = async (
  userInput: string,
  allSourceIds: number[],
  activeSources: SourceRow[],
  attachmentSourceIds: number[],
  vectorStore: OPSQLiteVectorStore,
  embeddings?: LFMEmbeddings | null,
  maxRelevantChunks?: number
) => {
  try {
    const relevantChunks = await hybridRetrieve({
      prompt: userInput,
      enabledSourceIds: allSourceIds,
      vectorStore,
      sourceNamesById: new Map(activeSources.map((s) => [s.id, s.name])),
      embeddings,
      attachmentSourceIds,
      maxRelevantChunks,
    });
    return relevantChunks;
  } catch (error) {
    console.error('Error preparing context:', error);
    return [];
  }
};

export interface BuildMessageSourcesParams {
  userInput: string;
  attachmentSourceIds: number[];
  enabledSources: number[];
  sources: SourceRow[];
  vectorStore: OPSQLiteVectorStore;
  embeddings?: LFMEmbeddings | null;
  maxRelevantChunks?: number;
  history?: { role: string; content: string }[];
  digest?: string;
}

export interface MessageSources {
  context: string[];
  sourceDocuments: SourceDocument[];
  preferredSourceDocuments: SourceDocument[];
}

export const buildMessageSources = async ({
  userInput,
  attachmentSourceIds,
  enabledSources,
  sources,
  vectorStore,
  embeddings,
  maxRelevantChunks,
  history,
  digest,
}: BuildMessageSourcesParams): Promise<MessageSources> => {
  const empty: MessageSources = {
    context: [],
    sourceDocuments: [],
    preferredSourceDocuments: [],
  };

  const allSourceIds = [
    ...new Set([...enabledSources, ...attachmentSourceIds]),
  ];
  if (allSourceIds.length === 0) return empty;

  const activeSources = sources.filter((s) => allSourceIds.includes(s.id));
  const activeAttachmentSources = activeSources.filter((s) =>
    attachmentSourceIds.includes(s.id)
  );
  const preferredSourceDocuments = getAttachmentSourceDocuments(
    activeSources,
    attachmentSourceIds
  );
  const attachmentOverview = () =>
    formatFirstChunks(activeAttachmentSources, 'Current Attachment Source');

  const context: string[] = [];
  let sourceDocuments: SourceDocument[] = [];

  if (userInput.trim()) {
    const retrievalQuery = carryReferentIntoQuery(
      userInput,
      history ?? [],
      digest
    );
    const relevantChunks = await retrieveChunks(
      retrievalQuery,
      allSourceIds,
      activeSources,
      attachmentSourceIds,
      vectorStore,
      embeddings,
      maxRelevantChunks
    );
    context.push(...formatContextChunks(relevantChunks));
    context.push(...attachmentOverview());

    const retrieved = getSourceDocumentsFromChunks(relevantChunks);
    sourceDocuments = assembleSourceDocuments(
      retrieved,
      preferredSourceDocuments,
      attachmentSourceIds,
      activeSources,
      context.length > 0
    );
  } else if (attachmentSourceIds.length > 0) {
    sourceDocuments = preferredSourceDocuments;
    context.push(...attachmentOverview());
  }

  return { context, sourceDocuments, preferredSourceDocuments };
};

const ABSENCE_CLAIM =
  /nie (?:ma|zawieraj\w*|jest podan\w*|zosta\w* podan\w*|jest mo[żz]liwe)[^.!?]{0,40}(?:informacj|dan(?:e|ych)|ceny|kursu|kwoty)|[żz]r[óo]d[łl]a[^.!?]{0,30}nie (?:zawieraj|podaj)|brak (?:informacji|danych)|(?:sources?|search results|pages?)[^.!?]{0,30}(?:contain no|do not (?:contain|state|provide|include)|have no)|no (?:information|data) (?:about|on|for)|nie posiadam[^.!?]{0,30}informacj|nie jestem w stanie[^.!?]{0,40}(?:okre[śs]li|poda|wskaza|udzieli|odpowiedzie|por[óo]wna|oceni|stwierdzi|ustali|przedstawi|znale[źz])|nie mam dost[ęe]pu|(?:don'?t|do not) have access|(?:cannot|can't|unable to|not able to) (?:determine|provide|state|give|tell)/i;

const QUESTION_WANTS_DATE =
  /\bkiedy\b|\bwhen\b|\bwann\b|\bquand\b|\bcu[aá]ndo\b|\bquando\b|когда|कब/i;
const QUESTION_WANTS_AMOUNT =
  /\bile\b|\bilu\b|\bkurs\b|\bcen[ay]\b|\bkoszt\w*\b|\bhow (?:much|many)\b|\bprice\b|\bcost\b|\brate\b|\bpopulation\b|сколько|कितन/i;

const CONTEXT_DATE =
  /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b|\b\d{1,2}\s?(?:sty|lut|mar|kwi|maj|cze|lip|sie|wrz|pa[źz]|lis|gru|jan|feb|apr|jun|jul|aug|sep|oct|nov|dec)/i;
const CONTEXT_AMOUNT = /\d{1,3}(?:[.,\u00A0\u202F ]\d{3})+|\d+[.,]\d+|\d{4,}/;

const EVIDENCE_MIN_TOKENS = 5;
const EVIDENCE_MIN_ANSWER_CHARS = 40;
const DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0x09e6, 0xff10];
const ANY_DIGIT_CHAR = /\p{Nd}/gu;
const NUMBER_RUN = /\d[\d.,]*/g;
const NAME_RUN = /\p{Lu}[\p{L}\p{N}-]{2,}/gu;

const toAsciiDigits = (text: string): string =>
  text.replace(ANY_DIGIT_CHAR, (char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x30 && code <= 0x39) return char;
    for (const base of DIGIT_BASES) {
      if (code >= base && code <= base + 9) return String(code - base);
    }
    return char;
  });

export const distinctiveEvidence = (text: string): Set<string> => {
  const found = new Set<string>();
  if (!text) return found;
  const ascii = toAsciiDigits(text);
  for (const match of ascii.match(NUMBER_RUN) ?? []) {
    const value = match.replace(/[.,]+$/, '');
    if (value.length >= 2) found.add(value);
  }
  for (const match of text.match(NAME_RUN) ?? []) {
    found.add(foldForMatching(match));
  }
  return found;
};

export const answerUsesNoRetrievedEvidence = (
  answer: string,
  question: string | undefined,
  context: string
): boolean => {
  const visible = stripThinkBlocks(answer).trim();
  if (visible.length < EVIDENCE_MIN_ANSWER_CHARS) return false;
  const asked = distinctiveEvidence(question ?? '');
  const offered = distinctiveEvidence(context);
  for (const term of asked) offered.delete(term);
  if (offered.size < EVIDENCE_MIN_TOKENS) return false;
  for (const term of distinctiveEvidence(visible)) {
    if (offered.has(term)) return false;
  }
  return true;
};

export const claimsMissingEvidenceItHas = (
  answer: string,
  question: string | undefined,
  context: string,
  intent?: WebIntentKind
): boolean => {
  if (!question || !context.trim()) return false;
  const visible = stripThinkBlocks(answer);
  if (!visible || !ABSENCE_CLAIM.test(visible)) return false;
  const wantsDate = intent === 'date' || QUESTION_WANTS_DATE.test(question);
  if (wantsDate && CONTEXT_DATE.test(context)) return true;
  const wantsAmount =
    intent === 'price' || QUESTION_WANTS_AMOUNT.test(question);
  return wantsAmount && CONTEXT_AMOUNT.test(context);
};
