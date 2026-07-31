export const KEYWORD_TABLE = 'chunk_fts';

// unicode61 folds decomposable Polish letters but not ł (see foldForKeywordIndex).
export const FTS_TOKENIZER = 'unicode61 remove_diacritics 2';
