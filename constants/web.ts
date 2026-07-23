export const WEB_SEARCH_MAX_RESULTS = 5;
export const WEB_SEARCH_TIMEOUT_MS = 8000;
export const WEB_SNIPPET_MAX_CHARS = 500;
export const WEB_FETCH_TOP_N_CONTENT = 2;
export const WEB_CONTENT_MAX_CHARS = 1500;
export const WEB_CONTENT_MIN_CHARS = 120;

export const WEB_ADAPTIVE_ENRICH = true;
export const WEB_ENRICH_WAVE_FIRST = 2;
export const WEB_ENRICH_WAVE_STEP = 2;
export const WEB_CONTENT_FETCH_TIMEOUT_MS = 8000;

export const WEB_RETRIEVAL_FETCH_TOP_N = 5;
export const WEB_RETRIEVAL_PAGE_MAX_CHARS = 6000;
export const WEB_RETRIEVAL_CHUNK_CHARS = 500;
export const WEB_RETRIEVAL_CHUNK_OVERLAP = 80;
export const WEB_RETRIEVAL_MAX_CHUNKS = 40;
export const WEB_RETRIEVAL_TOP_K = 6;
export const WEB_RETRIEVAL_MAX_PER_PAGE = 3;

export const WEB_FAVICON_URL = (host: string): string =>
  `https://icons.duckduckgo.com/ip3/${host}.ico`;

export const WEB_CORRECTIVE_ENABLED = true;
export const WEB_EVAL_CONFIDENCE_HIGH = 0.6;
export const WEB_EVAL_CONFIDENCE_LOW = 0.35;
export const WEB_CORRECTIVE_MAX_ROUNDS = 1;
export const WEB_CORRECTIVE_MERGED_MAX_RESULTS = 8;
export const WEB_CORRECTIVE_LLM_REWRITE = true;
export const WEB_CORRECTIVE_EVIDENCE_PAGES = 3;
export const WEB_CORRECTIVE_EVIDENCE_MAX_CHARS = 400;
export const WEB_AGREEMENT_ENABLED = true;
export const WEB_AGREEMENT_MIN_HOSTS = 2;
export const WEB_AGREEMENT_SINGLE_HOST_FACTOR = 0.85;
export const WEB_AGREEMENT_MAX_CLAIMS = 12;
export const WEB_AGREEMENT_MAX_TEXT_CHARS = 4000;
export const WEB_AGREEMENT_MIN_BARE_VALUE = 10;

export const WEB_POSTGEN_CORRECTION_ENABLED = false;

export const WEB_QUERY_REWRITE = true;
export const WEB_QUERY_CONTEXT_TURNS = 6;
export const WEB_QUERY_CONTEXT_TURN_MAX_CHARS = 300;
export const WEB_QUERY_MAX_CHARS = 160;
export const WEB_QUERY_GATE = true;
export const WEB_QUERY_MAX_SUBQUERIES = 2;
export const WEB_QUERY_CONCISE_MAX_WORDS = 6;
export const WEB_QUERY_INTENT_MAX_CHARS = 80;

export const URL_FETCH_TIMEOUT_MS = 12000;
export const URL_FETCH_MAX_BYTES = 2_000_000;
export const URL_FETCH_USER_AGENT =
  'Mozilla/5.0 (compatible; PrivateMind/1.0; +on-device)';

export const WEB_SEARCH_ENABLED = true;

export interface ScrapeEngine {
  id: string;
  url: string;
}

export const SCRAPE_ENGINES: ScrapeEngine[] = [
  { id: 'ddg-html', url: 'https://html.duckduckgo.com/html/?q=' },
  { id: 'ddg-lite', url: 'https://lite.duckduckgo.com/lite/?q=' },
  { id: 'mojeek', url: 'https://www.mojeek.com/search?q=' },
];
export const SCRAPE_MAX_PARALLEL = 1;
export const SCRAPE_MIN_DELAY_MS = 1500;
export const SCRAPE_PAGE_LOAD_TIMEOUT_MS = 20000;
export const SCRAPE_CHALLENGE_TIMEOUT_MS = 120000;
export const SCRAPE_REINJECT_DELAY_MIN_MS = 1000;
export const SCRAPE_REINJECT_DELAY_MAX_MS = 2200;
