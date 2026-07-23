import { STRONG_SEMANTIC_THRESHOLD } from '../../constants/retrieval';
import {
  WEB_AGREEMENT_MIN_HOSTS,
  WEB_AGREEMENT_SINGLE_HOST_FACTOR,
  WEB_EVAL_CONFIDENCE_HIGH,
  WEB_EVAL_CONFIDENCE_LOW,
} from '../../constants/web';
import type { SourceAgreement } from './sourceAgreement';

export interface WebRetrievalSignals {
  embedded: boolean;
  chunkCount: number;
  qualifiedCount: number;
  distinctPages: number;
  maxSimilarity: number;
  topCoverage: number;
}

export interface RetrievalEvaluationInput {
  resultCount: number;
  contentCount: number;
  retrieval: WebRetrievalSignals | null;
  agreement?: SourceAgreement | null;
}

export type RetrievalLabel = 'correct' | 'ambiguous' | 'incorrect';

export interface RetrievalEvaluation {
  confidence: number;
  label: RetrievalLabel;
  shouldCorrect: boolean;
}

const W_SIMILARITY = 0.4;
const W_COVERAGE = 0.3;
const W_QUALIFIED = 0.2;
const W_PAGES = 0.1;

const QUALIFIED_TARGET = 3;
const PAGES_TARGET = 2;

const LEAN_WITH_CONTENT = WEB_EVAL_CONFIDENCE_HIGH;
const LEAN_SNIPPETS_ONLY = 0.3;

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

const bucket = (confidence: number): RetrievalLabel =>
  confidence >= WEB_EVAL_CONFIDENCE_HIGH
    ? 'correct'
    : confidence <= WEB_EVAL_CONFIDENCE_LOW
      ? 'incorrect'
      : 'ambiguous';

const finalize = (confidence: number): RetrievalEvaluation => {
  const label = bucket(confidence);
  return { confidence, label, shouldCorrect: label !== 'correct' };
};

const rawConfidence = (input: RetrievalEvaluationInput): number => {
  if (input.resultCount === 0) return 0;

  const { retrieval } = input;

  if (!retrieval || !retrieval.embedded) {
    return input.contentCount > 0 ? LEAN_WITH_CONTENT : LEAN_SNIPPETS_ONLY;
  }

  if (retrieval.qualifiedCount === 0) {
    return (
      W_SIMILARITY *
      clamp01(retrieval.maxSimilarity / STRONG_SEMANTIC_THRESHOLD)
    );
  }

  const simScore = clamp01(retrieval.maxSimilarity / STRONG_SEMANTIC_THRESHOLD);
  const covScore = clamp01(retrieval.topCoverage);
  const qualScore = clamp01(retrieval.qualifiedCount / QUALIFIED_TARGET);
  const pageScore = clamp01(retrieval.distinctPages / PAGES_TARGET);

  return clamp01(
    W_SIMILARITY * simScore +
      W_COVERAGE * covScore +
      W_QUALIFIED * qualScore +
      W_PAGES * pageScore
  );
};

const independenceFactor = (
  agreement: SourceAgreement | null | undefined
): number =>
  !agreement || agreement.independentHosts >= WEB_AGREEMENT_MIN_HOSTS
    ? 1
    : WEB_AGREEMENT_SINGLE_HOST_FACTOR;

export const evaluateWebRetrieval = (
  input: RetrievalEvaluationInput
): RetrievalEvaluation =>
  finalize(clamp01(rawConfidence(input) * independenceFactor(input.agreement)));
