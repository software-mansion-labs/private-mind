/** Candidates each retriever contributes before fusion. */
export const CANDIDATE_POOL = 20;

/** Final chunks kept after re-ranking (MMR selection size). */
export const MAX_RELEVANT_CHUNKS = 5;

/** Bonus that floats a freshly-attached chunk past the gate to the pool's front. */
export const ATTACHMENT_RELEVANCE_BONUS = 10;

/** Max chunks kept from one document in the final selection, applied only when ≥2 documents qualify. */
export const MAX_CHUNKS_PER_FILE = 3;

/** Cosine floor to qualify a chunk on semantic similarity; above LFM2.5's ~0.35–0.45 noise floor. */
export const STRONG_SEMANTIC_THRESHOLD = 0.55;

/** After generation, cite a non-attachment document only if its answer↔passage term overlap is at least this fraction of the strongest cited document's — attributes the reply to the source(s) it was actually based on. */
export const ANSWER_CITATION_OVERLAP_RATIO = 0.5;

export const TEXT_SPLITTER_CHUNK_SIZE = 1000;
export const TEXT_SPLITTER_CHUNK_OVERLAP = 200;

/** Safety backstop on chunks embedded per source; high enough that large real documents (~1.6 MB of text) index in full, low enough to stop a pathological multi-MB file from embedding for tens of minutes. */
export const MAX_SOURCE_CHUNKS = 2000;

/** Min matched run to treat as overlap when stitching passages — below the splitter overlap, above coincidental repetition. */
export const MIN_STITCH_OVERLAP = 24;

export const SOURCE_HEADER = /--- [^:]+: (.+?) ---/g;
