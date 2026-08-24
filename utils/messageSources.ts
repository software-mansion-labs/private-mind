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
import { extractQueryTerms, stemPrefix } from './queryTerms';
import {
  findUngroundedFigures,
  isUngroundedConversionClaim,
  isUngroundedTrendClaim,
} from './web/figureGrounding';
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

const SOURCE_REFERENCE = /(?<![\p{L}\p{N}])(?:sources?|źródł\w*)\s*(\d+)\b/giu;

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
  text
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:]+$/, '');

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

const DANGLING_LIST_INTRO = /[:：]\s*$/;

export const isDanglingListAnswer = (answer: string): boolean => {
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  return DANGLING_LIST_INTRO.test(visible);
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
    const relevantChunks = await retrieveChunks(
      userInput,
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
