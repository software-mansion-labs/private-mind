import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import { SourceDocument } from '../database/chatRepository';
import {
  formatContextChunks,
  formatFirstChunks,
  getSourceDocumentsFromChunks,
  sourceKey,
  sourcesPresentInContext,
} from './contextUtils';
import { retrieve } from './retrieval';
import { extractQueryTerms, stemPrefix } from './queryTerms';
import { ANSWER_CITATION_OVERLAP_RATIO } from '../constants/retrieval';
import {
  CITATION_SENTENCE_PATTERN,
  CLAUSE_SPLIT_PATTERN,
  NEGATION_CUE_EN,
  NO_ANSWER_PATTERNS_EN,
  THINK_CLOSE,
  THINK_OPEN,
} from '../constants/citations';

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
    (doc) => preferredNames.has(doc.name) || present.has(doc.name)
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
export const visibleAnswer = (answer: string): string => {
  const parts: string[] = [];
  let cursor = 0;
  let open = answer.indexOf(THINK_OPEN);

  while (open !== -1) {
    parts.push(answer.slice(cursor, open));
    const close = answer.indexOf(THINK_CLOSE, open + THINK_OPEN.length);
    // Unterminated: the model is still reasoning, so nothing after it is visible.
    if (close === -1) return `${parts.join(' ')} `;
    cursor = close + THINK_CLOSE.length;
    open = answer.indexOf(THINK_OPEN, cursor);
  }

  parts.push(answer.slice(cursor));
  return parts.join(' ');
};

// Keep only the clauses the reply actually asserts; a negated clause names a topic
// the source does not cover, and scoring it as overlap cites the source for the
// opposite of what it says. English-only for now.
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

// True when the visible reply is an EN/PL "no information" refusal (negation tied to a coverage noun).
export const looksLikeNoAnswer = (visibleReply: string): boolean =>
  NO_ANSWER_PATTERNS_EN.some((pattern) => pattern.test(visibleReply));

// Compact per-document overlap for logs: `name:overlap` per candidate, so a surprising citation set is diagnosable.
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

export const pickCitationsByAnswer = (
  sourceDocuments: SourceDocument[],
  answer: string,
  preferred: SourceDocument[]
): SourceDocument[] => {
  if (sourceDocuments.length <= 1) return sourceDocuments;

  const preferredNames = new Set(preferred.map((doc) => doc.name));

  // A refusal cites nothing but a freshly-attached subject, even when it describes the sources.
  if (looksLikeNoAnswer(visibleAnswer(answer))) {
    return sourceDocuments.filter((doc) => preferredNames.has(doc.name));
  }

  const answerTerms = answerTermsOf(answer);
  const scored = sourceDocuments.map((doc) => ({
    doc,
    isPreferred: preferredNames.has(doc.name),
    overlap: answerTerms.size
      ? overlapWithAnswer(`${doc.name} ${doc.passage ?? ''}`, answerTerms)
      : 0,
  }));

  const maxOverlap = Math.max(0, ...scored.map((s) => s.overlap));

  // Reply echoes no candidate → not grounded in any; keep only a freshly-attached source, cite nothing else.
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
  embeddings?: LFMEmbeddings | null
) => {
  try {
    const relevantChunks = await retrieve({
      prompt: userInput,
      enabledSourceIds: allSourceIds,
      vectorStore,
      sourceNamesById: new Map(activeSources.map((s) => [s.id, s.name])),
      embeddings,
      attachmentSourceIds,
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
      embeddings
    );
    context.push(...attachmentOverview());
    context.push(...formatContextChunks(relevantChunks));

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
