import { evaluateWebRetrieval } from '../utils/web/retrievalEvaluator';
import type { WebRetrievalSignals } from '../utils/web/retrievalEvaluator';
import {
  WEB_EVAL_CONFIDENCE_HIGH,
  WEB_EVAL_CONFIDENCE_LOW,
} from '../constants/web';

const signals = (
  over: Partial<WebRetrievalSignals> = {}
): WebRetrievalSignals => ({
  embedded: true,
  chunkCount: 10,
  qualifiedCount: 3,
  distinctPages: 2,
  maxSimilarity: 0.5,
  topCoverage: 1,
  ...over,
});

describe('evaluateWebRetrieval', () => {
  it('is incorrect with zero confidence when nothing was found', () => {
    const e = evaluateWebRetrieval({
      resultCount: 0,
      contentCount: 0,
      retrieval: null,
    });
    expect(e.confidence).toBe(0);
    expect(e.label).toBe('incorrect');
    expect(e.shouldCorrect).toBe(true);
  });

  it('is correct (no corrective round) on strong retrieval signals', () => {
    const e = evaluateWebRetrieval({
      resultCount: 5,
      contentCount: 3,
      retrieval: signals(),
    });
    expect(e.confidence).toBeGreaterThanOrEqual(WEB_EVAL_CONFIDENCE_HIGH);
    expect(e.label).toBe('correct');
    expect(e.shouldCorrect).toBe(false);
  });

  it('is incorrect when embeddings ran but nothing cleared the gate', () => {
    const e = evaluateWebRetrieval({
      resultCount: 4,
      contentCount: 2,
      retrieval: signals({
        qualifiedCount: 0,
        maxSimilarity: 0.1,
        topCoverage: 0,
      }),
    });
    expect(e.confidence).toBeLessThanOrEqual(WEB_EVAL_CONFIDENCE_LOW);
    expect(e.label).toBe('incorrect');
    expect(e.shouldCorrect).toBe(true);
  });

  it('is ambiguous on middling signals (fires a corrective round)', () => {
    const e = evaluateWebRetrieval({
      resultCount: 3,
      contentCount: 1,
      retrieval: signals({
        qualifiedCount: 1,
        distinctPages: 1,
        maxSimilarity: 0.2,
        topCoverage: 0.3,
      }),
    });
    expect(e.confidence).toBeGreaterThan(WEB_EVAL_CONFIDENCE_LOW);
    expect(e.confidence).toBeLessThan(WEB_EVAL_CONFIDENCE_HIGH);
    expect(e.label).toBe('ambiguous');
    expect(e.shouldCorrect).toBe(true);
  });

  it('lean path: trusts extracted content when embeddings are unavailable', () => {
    const e = evaluateWebRetrieval({
      resultCount: 4,
      contentCount: 2,
      retrieval: null,
    });
    expect(e.label).toBe('correct');
    expect(e.shouldCorrect).toBe(false);
  });

  it('lean path: flags SERP hits that yielded no page text', () => {
    const e = evaluateWebRetrieval({
      resultCount: 4,
      contentCount: 0,
      retrieval: null,
    });
    expect(e.label).not.toBe('correct');
    expect(e.shouldCorrect).toBe(true);
  });

  it('treats an embedded:false signal like the lean path', () => {
    const e = evaluateWebRetrieval({
      resultCount: 4,
      contentCount: 2,
      retrieval: signals({ embedded: false }),
    });
    expect(e.label).toBe('correct');
  });
});
