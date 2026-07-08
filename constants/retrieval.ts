/** Candidates each retriever contributes before fusion. */
export const CANDIDATE_POOL = 20;

/** Final chunks kept after re-ranking (MMR selection size). */
export const MAX_RELEVANT_CHUNKS = 5;

/** RRF constant in `weight / (k + rank)`; 60 is the paper default. */
export const RRF_K = 60;

/** Per-retriever RRF weights (KEYWORD = exact-match recall, VECTOR = semantic). */
export const VECTOR_WEIGHT = 1;
export const KEYWORD_WEIGHT = 1;

/** MMR trade-off: higher = relevance, lower = diversity. */
export const MMR_LAMBDA = 0.7;

/** Coverage boost: `relevance *= 1 + COVERAGE_ALPHA * coverage`. */
export const COVERAGE_ALPHA = 0.5;

/** Bonus that floats a freshly-attached chunk past the gate to the pool's front. */
export const ATTACHMENT_RELEVANCE_BONUS = 10;

/** Max chunks kept from one document in the final selection, applied only when ≥2 documents qualify. */
export const MAX_CHUNKS_PER_FILE = 3;

/** Adaptive-k: after MMR, drop trailing chunks once relevance falls below this fraction of the previous. */
export const ADAPTIVE_K_DROP_RATIO = 0.45;

/** Adaptive-k never trims below this many non-attachment chunks. */
export const ADAPTIVE_K_MIN_KEEP = 1;

/** Cosine floor to qualify on semantics alone; above LFM2.5's ~0.35–0.45 noise floor. */
export const STRONG_SEMANTIC_THRESHOLD = 0.55;

/** Min cosine to qualify via lexical overlap (paired with non-zero term coverage). */
export const LEXICAL_MATCH_MIN_SIMILARITY = 0.1;

export const TEXT_SPLITTER_CHUNK_SIZE = 1000;
export const TEXT_SPLITTER_CHUNK_OVERLAP = 200;
