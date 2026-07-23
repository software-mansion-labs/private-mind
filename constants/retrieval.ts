/** Candidates pulled from the vector store before gating and re-ranking. */
export const CANDIDATE_POOL = 20;

/** Final chunks kept after gating and per-file capping. */
export const MAX_RELEVANT_CHUNKS = 5;

/** Bonus that floats a freshly-attached chunk past the gate to the pool's front. */
export const ATTACHMENT_RELEVANCE_BONUS = 10;

/** Max chunks kept from one document in the final selection, applied only when ≥2 documents qualify. */
export const MAX_CHUNKS_PER_FILE = 3;

/** Cosine floor to qualify on semantics alone. Measured on-device: LFM2.5 true paraphrase matches land ~0.28–0.54, so 0.40 admits clear matches while most unrelated passages stay below. */
export const STRONG_SEMANTIC_THRESHOLD = 0.4;

/** The single highest-similarity candidate always qualifies above this floor, so the best semantic match is never fully gated out (empty result) on a paraphrase that falls just short of the main threshold. */
export const SEMANTIC_TOP_KEEP_FLOOR = 0.25;

/** After generation, cite a non-attachment document only if its answer↔passage term overlap is at least this fraction of the strongest cited document's — attributes the reply to the source(s) it was actually based on. */
export const ANSWER_CITATION_OVERLAP_RATIO = 0.5;

export const TEXT_SPLITTER_CHUNK_SIZE = 1000;
export const TEXT_SPLITTER_CHUNK_OVERLAP = 200;

/** Safety backstop on chunks embedded per source; high enough that large real documents (~1.6 MB of text) index in full, low enough to stop a pathological multi-MB file from embedding for tens of minutes. */
export const MAX_SOURCE_CHUNKS = 2000;

/** Hard cap on extracted text fed to the splitter, so a pathological multi-MB document can't blow up the chunk array (and memory) before the chunk backstop applies. Derived from the chunk backstop and chunk size. */
export const MAX_SOURCE_TEXT_CHARS =
  MAX_SOURCE_CHUNKS * TEXT_SPLITTER_CHUNK_SIZE;

/** Min matched run to treat as overlap when stitching passages — below the splitter overlap, above coincidental repetition. */
export const MIN_STITCH_OVERLAP = 24;

export const SOURCE_HEADER = /--- [^:]+: (.+?) ---/g;
