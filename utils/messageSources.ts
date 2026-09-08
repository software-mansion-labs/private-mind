import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { LFMEmbeddings } from './lfmEmbeddings';
import { toAsciiDigits } from './asciiDigits';
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
import { hostname } from './web/webResultsToContext';
import { ANSWER_CITATION_OVERLAP_RATIO } from '../constants/retrieval';
import { ISO_CURRENCY_CODES } from '../constants/currencies';
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
const SOURCE_LABEL = /\[Answers:[^\]\n]*\]\s*[-–—:]?\s*/gi;

const sourceDisplayName = (doc: SourceDocument): string =>
  sourceKind(doc) === 'web' && doc.url ? hostname(doc.url) : doc.name;

export const humanizeSourceReferences = (
  answer: string,
  sourceDocuments: SourceDocument[]
): string => {
  if (sourceDocuments.length === 0) return answer;
  return answer.replace(SOURCE_REFERENCE, (match, numeral: string) => {
    const doc = sourceDocuments[Number(numeral) - 1];
    return doc ? sourceDisplayName(doc) : match;
  });
};

export const stripSourceLabels = (answer: string): string =>
  answer.replace(SOURCE_LABEL, '');

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

const DETAIL_FIGURE = /(?<![\p{L}\p{N}])\d(?:[\d.,:]*\d)?(?![\p{L}\p{N}])/gu;
const RETRY_LENGTH_FLOOR = 0.6;

const detailFigures = (text: string): Set<string> =>
  new Set([...text.matchAll(DETAIL_FIGURE)].map((match) => match[0]!));

export const retryDropsGroundedDetail = (
  original: string,
  retried: string
): boolean => {
  const before = stripThinkBlocks(original).trim();
  const after = stripThinkBlocks(retried).trim();
  if (!before || !after) return false;
  const had = detailFigures(before);
  if (had.size === 0) return false;
  if ([...had].some((figure) => after.includes(figure))) return false;
  return after.length < before.length * RETRY_LENGTH_FLOOR;
};

const MIN_LANGUAGE_EVIDENCE = 2;

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
  if (!actual || actual.code === expected.code) return false;
  if (actual.script && expected.script && actual.script !== expected.script) {
    return true;
  }
  return (actual.evidence ?? 0) >= MIN_LANGUAGE_EVIDENCE;
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

const QUESTION_WANTS_DATE =
  /\bkiedy\b|\bwhen\b|\bwann\b|\bquand\b|\bcu[aá]ndo\b|\bquando\b|когда|कब/i;
const QUESTION_WANTS_AMOUNT =
  /\bile\b|\bilu\b|\bkurs\b|\bcen[ay]\b|\bkoszt\w*\b|\bhow (?:much|many)\b|\bprice\b|\bcost\b|\brate\b|\bpopulation\b|сколько|कितन/i;

const CONTEXT_DATE =
  /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b|\b\d{1,2}\s?(?:sty|lut|mar|kwi|maj|cze|lip|sie|wrz|pa[źz]|lis|gru|jan|feb|apr|jun|jul|aug|sep|oct|nov|dec)/i;
const CONTEXT_AMOUNT =
  /\d{1,3}(?:[.,\u00A0\u202F ]\d{3})+|\d+[.,]\d+|\p{Sc}\s?\d+|\d{2,}\s?(?:\p{Sc}|\p{L}{1,3}(?!\p{L}))/u;
const CONTEXT_SPEC_FIGURE = /\d{2,}\s?\p{L}/u;

const EVIDENCE_MIN_TOKENS = 5;
const EVIDENCE_MIN_ANSWER_CHARS = 40;
const NUMBER_RUN = /\d[\d.,:]*/g;
const NAME_RUN = /\p{Lu}[\p{L}\p{N}-]{2,}/gu;
const GROUPED_FIGURE = /^\d{1,3}(?:[.,:]\d{2,3})+$/;

const separatorFreeFigure = (value: string): string | null =>
  GROUPED_FIGURE.test(value) ? value.replace(/[.,:]/g, '') : null;

const SOURCE_MARKER_LINE = /^[ \t]*--- (?:End of )?Source \d+.*?---[ \t]*$/gmu;
const SENTENCE_OPENING = /(?:^|[.!?…:\n])[\s"'„«»()[\]—–-]*$/u;

const opensSentence = (text: string, at: number): boolean =>
  SENTENCE_OPENING.test(text.slice(Math.max(0, at - 24), at));

export const distinctiveEvidence = (text: string): Set<string> => {
  const found = new Set<string>();
  if (!text) return found;
  const ascii = toAsciiDigits(text);
  for (const match of ascii.match(NUMBER_RUN) ?? []) {
    const value = match.replace(/[.,:]+$/, '');
    if (value.length < 2) continue;
    found.add(value);
    const grouped = separatorFreeFigure(value);
    if (grouped) found.add(grouped);
  }
  for (const match of text.matchAll(NAME_RUN)) {
    if (opensSentence(text, match.index ?? 0)) continue;
    found.add(foldForMatching(match[0]));
  }
  return found;
};

const SOURCES_BLOCK = /<sources>([\s\S]*?)<\/sources>/;

export const sourcesBlockOf = (promptContent: string): string =>
  promptContent.match(SOURCES_BLOCK)?.[1] ?? promptContent;

const contentStems = (text: string): Set<string> =>
  new Set(
    [...extractQueryTerms(text)].map((term) =>
      stemPrefix(foldForMatching(term))
    )
  );

const sharesWording = (
  answer: string,
  context: string,
  question: string | undefined
): boolean => {
  const asked = contentStems(question ?? '');
  const offered = contentStems(context.replace(SOURCE_MARKER_LINE, ''));
  for (const stem of asked) offered.delete(stem);
  if (offered.size === 0) return true;
  for (const stem of contentStems(answer)) {
    if (offered.has(stem)) return true;
  }
  return false;
};

export const answerUsesNoRetrievedEvidence = (
  answer: string,
  question: string | undefined,
  context: string
): boolean => {
  const visible = stripThinkBlocks(answer).trim();
  if (visible.length < EVIDENCE_MIN_ANSWER_CHARS) return false;
  const asked = distinctiveEvidence(question ?? '');
  const offered = distinctiveEvidence(context.replace(SOURCE_MARKER_LINE, ''));
  for (const term of asked) offered.delete(term);
  if (offered.size < EVIDENCE_MIN_TOKENS) return false;
  const carried = distinctiveEvidence(visible);
  if (carried.size === 0) return !sharesWording(visible, context, question);
  for (const term of carried) {
    if (offered.has(term)) return false;
  }
  return true;
};

const ASPECT_MIN_ANSWER_CHARS = 40;
const SITE_OPERATOR = /\bsite:\S+/gi;

const aspectStems = (query: string): string[] => {
  const plain = query.replace(SITE_OPERATOR, ' ');
  return [
    ...new Set(
      [...extractQueryTerms(plain, detectQuestionLanguage(plain)?.code)]
        .filter((term) => !ISO_CURRENCY_CODES.has(term))
        .map((term) => stemPrefix(foldForMatching(term)))
    ),
  ];
};

const mentionsStem = (folded: string, stem: string): boolean =>
  stem.length >= 4
    ? folded.includes(stem)
    : new RegExp(
        `(?<![\\p{L}\\p{N}])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'u'
      ).test(folded);

export const aspectsMissingFromAnswer = (
  answer: string,
  subQueries: string[] | undefined,
  context: string
): string[] => {
  if (!subQueries || subQueries.length < 2 || !context.trim()) return [];
  const visible = foldForMatching(stripThinkBlocks(answer).trim());
  if (visible.length < ASPECT_MIN_ANSWER_CHARS) return [];
  const evidence = foldForMatching(context);
  const stemsOf = subQueries.map(aspectStems);
  return subQueries.filter((_, index) => {
    const elsewhere = new Set(
      stemsOf.flatMap((stems, other) => (other === index ? [] : stems))
    );
    const distinctive = stemsOf[index]!.filter((stem) => !elsewhere.has(stem));
    return (
      distinctive.some((stem) => mentionsStem(evidence, stem)) &&
      !distinctive.some((stem) => mentionsStem(visible, stem))
    );
  });
};

const YEAR_TOKEN = /(?<![\p{N}])(?:19|20)\d{2}(?![\p{N}])/gu;
const MIXED_TOKEN =
  /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}-]*\p{L})(?=[\p{L}\p{N}-]*\p{N})[\p{L}\p{N}-]+/gu;
const NUMBER_WITH_UNIT = /^\p{N}[\p{N}.,]*\p{L}+$/u;

const withoutCodes = (text: string): string =>
  text.replace(MIXED_TOKEN, (token) =>
    NUMBER_WITH_UNIT.test(token) ? token : ' '
  );

const IDENTIFIER_RUN = /^\d{8,}$/;

const figuresStated = (text: string): Set<string> =>
  new Set(
    (
      withoutCodes(toAsciiDigits(text))
        .replace(YEAR_TOKEN, ' ')
        .match(NUMBER_RUN) ?? []
    )
      .map((run) => run.replace(/[.,]+$/, ''))
      .filter((run) => !IDENTIFIER_RUN.test(run))
  );

export const answerStatesFigure = (
  visible: string,
  question: string = ''
): boolean => {
  const asked = figuresStated(question);
  for (const figure of figuresStated(visible)) {
    if (!asked.has(figure)) return true;
  }
  return false;
};

const LEAD_SENTENCES = 1;
const SENTENCE_BREAK = /(?<=[.!?…])\s+|\n+/u;
const FIGURE_LEAD_KINDS: ReadonlySet<string> = new Set([
  'fact',
  'price',
  'specs',
]);

const leadOf = (answer: string): string =>
  stripThinkBlocks(answer)
    .trim()
    .split(SENTENCE_BREAK)
    .filter((sentence) => sentence.trim())
    .slice(0, LEAD_SENTENCES)
    .join(' ');

const EVIDENCE_LINES_MAX = 3;
const EVIDENCE_LINE_MAX_CHARS = 200;
const EVIDENCE_WINDOW_WORDS = 12;
const EVIDENCE_WINDOW_PADDING = 3;
const TOPIC_STEM_DISCOUNT = 0.5;
const BARE_DIGIT_DISCOUNT = 0.25;
const QUESTION_SENTENCE = /\?\s*$/u;
const MEASUREMENT_FIGURE = /\p{N}{2,}|\p{N}\s?(?:[°%]|\p{Sc})/u;

const figureQuality = (words: string[], at: number): number =>
  at !== -1 &&
  MEASUREMENT_FIGURE.test(toAsciiDigits(words.slice(at, at + 2).join(' ')))
    ? 1
    : BARE_DIGIT_DISCOUNT;
const SOURCE_TITLE_LINE = /^[ \t]*--- Source \d+: (.*?) ---[ \t]*$/gmu;

const stemWeights = (
  sentences: string[],
  stems: string[]
): Map<string, number> => {
  const folded = sentences.map(foldForMatching);
  return new Map(
    stems.map((stem) => {
      const hits = folded.filter((sentence) =>
        mentionsStem(sentence, stem)
      ).length;
      return [stem, hits === 0 ? 0 : Math.log((sentences.length + 1) / hits)];
    })
  );
};

const topicStemsOf = (context: string, stems: string[]): Set<string> => {
  const titles = [...context.matchAll(SOURCE_TITLE_LINE)].map((match) =>
    foldForMatching(match[1] ?? '')
  );
  const topic = new Set(
    stems.filter((stem) => titles.some((title) => mentionsStem(title, stem)))
  );
  return topic.size === stems.length ? new Set() : topic;
};

interface EvidenceCandidate {
  words: string[];
  index: number;
  score: number;
  anchor: number;
  figure: number;
}

const locateEvidence = (
  sentence: string,
  index: number,
  stems: string[],
  topic: Set<string>,
  weights: Map<string, number>,
  question: string
): EvidenceCandidate => {
  const words = sentence.split(/\s+/);
  const figures = words.flatMap((word, at) =>
    answerStatesFigure(word, question) ? [at] : []
  );
  const nearest = (at: number): number =>
    figures.reduce(
      (best, figure) =>
        best === -1 || Math.abs(figure - at) < Math.abs(best - at)
          ? figure
          : best,
      -1
    );
  let score = 0;
  let anchor = -1;
  let anchorRank = -1;
  let figure = -1;
  let topicAnchor = -1;
  let topicRank = -1;
  for (const stem of stems) {
    const at = words.findIndex((word) =>
      mentionsStem(foldForMatching(word), stem)
    );
    if (at === -1) continue;
    const weight = weights.get(stem) ?? 0;
    if (topic.has(stem)) {
      score += weight * TOPIC_STEM_DISCOUNT;
      if (weight > topicRank) {
        topicRank = weight;
        topicAnchor = at;
      }
      continue;
    }
    const near = nearest(at);
    const close = near !== -1 && Math.abs(near - at) <= EVIDENCE_WINDOW_WORDS;
    if (close) score += weight;
    const rank = weight + (close ? 1 : 0);
    if (rank > anchorRank) {
      anchorRank = rank;
      anchor = at;
      figure = close ? near : -1;
    }
  }
  if (anchor === -1) {
    anchor = Math.max(0, topicAnchor);
    const near = nearest(anchor);
    figure =
      near !== -1 && Math.abs(near - anchor) <= EVIDENCE_WINDOW_WORDS
        ? near
        : -1;
  }
  const best = figure === -1 ? nearest(anchor) : figure;
  return {
    words,
    index,
    score: figures.length === 0 ? 0 : score * figureQuality(words, best),
    anchor,
    figure,
  };
};

const figureDistance = (candidate: EvidenceCandidate): number =>
  candidate.figure === -1
    ? Number.POSITIVE_INFINITY
    : Math.abs(candidate.figure - candidate.anchor);

const clipAroundStem = (candidate: EvidenceCandidate): string => {
  const { words, anchor, figure } = candidate;
  const sentence = words.join(' ');
  if (sentence.length <= EVIDENCE_LINE_MAX_CHARS) return sentence;
  const span = figure === -1 ? [anchor, anchor] : [anchor, figure];
  const lo = Math.min(...span);
  const hi = Math.max(...span);
  return words
    .slice(
      Math.max(0, lo - EVIDENCE_WINDOW_PADDING),
      hi + EVIDENCE_WINDOW_PADDING + 1
    )
    .join(' ');
};

export const evidenceLinesFor = (
  question: string | undefined,
  context: string
): string[] => {
  const asked = question ?? '';
  const stems = aspectStems(asked);
  if (stems.length === 0) return [];
  const topic = topicStemsOf(context, stems);
  const sentences = context
    .replace(SOURCE_MARKER_LINE, '')
    .split(SENTENCE_BREAK)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !QUESTION_SENTENCE.test(sentence));
  const weights = stemWeights(sentences, stems);
  const candidates = sentences
    .map((sentence, index) =>
      locateEvidence(sentence, index, stems, topic, weights, asked)
    )
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        figureDistance(a) - figureDistance(b) ||
        a.index - b.index
    );
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const line = clipAroundStem(candidate);
    const key = foldForMatching(line);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length === EVIDENCE_LINES_MAX) break;
  }
  return lines;
};

export const contextOffersFigureFor = (
  question: string | undefined,
  context: string
): boolean => evidenceLinesFor(question, context).length > 0;

export const buriesFigureContextOffers = (
  answer: string,
  question: string | undefined,
  context: string,
  kind?: string
): boolean =>
  !!kind &&
  FIGURE_LEAD_KINDS.has(kind) &&
  contextOffersFigureFor(question, context) &&
  !answerStatesFigure(leadOf(answer), question);

export const claimsMissingEvidenceItHas = (
  answer: string,
  question: string | undefined,
  context: string,
  intent?: WebIntentKind
): boolean => {
  if (!question || !context.trim()) return false;
  const visible = stripThinkBlocks(answer);
  if (!visible) return false;
  const evidence = withoutCodes(
    context.replace(SOURCE_MARKER_LINE, '')
  ).replace(YEAR_TOKEN, ' ');
  const wantsDate =
    intent === 'date' ||
    intent === 'event' ||
    QUESTION_WANTS_DATE.test(question);
  if (wantsDate && CONTEXT_DATE.test(evidence)) {
    return (
      !CONTEXT_DATE.test(visible) && !answerStatesFigure(visible, question)
    );
  }
  const wantsAmount =
    intent === 'price' ||
    intent === 'specs' ||
    QUESTION_WANTS_AMOUNT.test(question);
  const contextStatesAmount =
    CONTEXT_AMOUNT.test(evidence) ||
    (intent === 'specs' && CONTEXT_SPEC_FIGURE.test(evidence));
  return (
    wantsAmount && contextStatesAmount && !answerStatesFigure(visible, question)
  );
};
