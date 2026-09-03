import { foldForMatching } from '../queryTerms';

export interface ConversationTurn {
  role: string;
  content: string;
}

const PROPER_NOUN_RUN =
  /(?<!\p{L})\p{Lu}[\p{L}\p{N}'-]*(?:\s+\p{Lu}[\p{L}\p{N}'-]*)+/gu;
const MODEL_TOKEN =
  /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}-]*\p{N})\p{L}[\p{L}\p{N}]*(?:-[\p{L}\p{N}]+)*(?![\p{L}\p{N}])/gu;
const MODEL_TOKEN_MIN_CHARS = 3;
const STEM_MIN_CHARS = 4;
const INFLECTION_MAX_EXTRA_CHARS = 3;
const SENTENCE_END = /[.!?:;\n]$/u;
const LIST_NUMBERING = /(?:^|\s)\(?\p{N}+[.)]$/u;
const TRAILING_OPENERS = /(?:[^\S\n]|["'“”„«»([\-–—•*])+$/u;
const WORD_BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}])';
const WORD_BOUNDARY_AFTER = '(?![\\p{L}\\p{N}])';

interface Mention {
  text: string;
  index: number;
}

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wordRegExp = (word: string, flags = 'u'): RegExp =>
  new RegExp(
    `${WORD_BOUNDARY_BEFORE}${escapeRegExp(word)}${WORD_BOUNDARY_AFTER}`,
    flags
  );

const modelTokensIn = (text: string): Mention[] =>
  [...text.matchAll(MODEL_TOKEN)]
    .filter((match) => match[0].length >= MODEL_TOKEN_MIN_CHARS)
    .map((match) => ({ text: match[0], index: match.index! }));

export const hasModelToken = (text: string): boolean =>
  modelTokensIn(text).length > 0;

const rawMentionsIn = (text: string): Mention[] => {
  const runs = [...text.matchAll(PROPER_NOUN_RUN)].map((match) => ({
    text: match[0],
    index: match.index!,
  }));
  const insideRun = (mention: Mention): boolean =>
    runs.some(
      (run) =>
        mention.index >= run.index &&
        mention.index < run.index + run.text.length
    );
  return [...runs, ...modelTokensIn(text).filter((m) => !insideRun(m))].sort(
    (a, b) => a.index - b.index
  );
};

export const namedEntitiesIn = (text: string): string[] =>
  rawMentionsIn(text).map((mention) => mention.text);

const wordCount = (text: string): number =>
  (text.trim().match(/\S+/gu) ?? []).length;

const qualifiesAsEntity = (text: string): boolean =>
  wordCount(text) >= 2 || hasModelToken(text);

const isSentenceInitial = (text: string, index: number): boolean => {
  const before = text.slice(0, index).replace(TRAILING_OPENERS, '');
  return (
    before === '' || SENTENCE_END.test(before) || LIST_NUMBERING.test(before)
  );
};

const appearsAsNameMidSentence = (word: string, corpus: string): boolean =>
  [...corpus.matchAll(wordRegExp(word, 'gu'))].some(
    (match) => !isSentenceInitial(corpus, match.index!)
  );

const appearsLowercase = (word: string, corpus: string): boolean =>
  wordRegExp(word.toLowerCase()).test(corpus);

const withoutSentenceOpener = (
  mention: Mention,
  text: string,
  corpus: string
): string | null => {
  if (!isSentenceInitial(text, mention.index)) return mention.text;
  const [opener, ...rest] = mention.text.split(/\s+/u);
  const remainder = rest.join(' ');
  if (hasModelToken(rest[0] ?? '')) return mention.text;
  if (appearsAsNameMidSentence(opener!, corpus)) return mention.text;
  if (appearsLowercase(opener!, corpus)) {
    return qualifiesAsEntity(remainder) ? remainder : null;
  }
  return qualifiesAsEntity(remainder) ? remainder : mention.text;
};

const entityMentionsIn = (text: string, corpus: string): string[] =>
  rawMentionsIn(text)
    .map((mention) => withoutSentenceOpener(mention, text, corpus))
    .filter((entity): entity is string => entity !== null);

const wordsOf = (entity: string): string[] =>
  foldForMatching(entity)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const sameWord = (a: string, b: string): boolean =>
  a === b ||
  (a.length >= STEM_MIN_CHARS &&
    b.length >= STEM_MIN_CHARS &&
    (a.startsWith(b) || b.startsWith(a)) &&
    Math.abs(a.length - b.length) <= INFLECTION_MAX_EXTRA_CHARS);

const modelKeysOf = (entity: string): string[] =>
  modelTokensIn(entity).map((mention) => foldForMatching(mention.text));

const sameModel = (a: string, b: string): boolean =>
  a.startsWith(b) || b.startsWith(a);

export const sameEntity = (a: string, b: string): boolean => {
  const modelsA = modelKeysOf(a);
  const modelsB = modelKeysOf(b);
  if (modelsA.length > 0 && modelsB.length > 0) {
    return modelsA.some((x) => modelsB.some((y) => sameModel(x, y)));
  }
  const wordsA = wordsOf(a);
  const wordsB = wordsOf(b);
  const [shorter, longer] =
    wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return (
    shorter.length > 0 &&
    shorter.every((word) => longer.some((other) => sameWord(word, other)))
  );
};

interface Cluster {
  forms: string[];
  count: number;
}

const clusterMentions = (mentions: string[]): Cluster[] => {
  const clusters: Cluster[] = [];
  for (const mention of mentions) {
    const cluster = clusters.find((c) => sameEntity(c.forms[0]!, mention));
    if (cluster) {
      cluster.forms.push(mention);
      cluster.count += 1;
    } else {
      clusters.push({ forms: [mention], count: 1 });
    }
  }
  return clusters;
};

const userFormOf = (
  cluster: Cluster,
  turns: ConversationTurn[],
  corpus: string
): string => {
  const fallback = cluster.forms[0]!;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]!.role !== 'user') continue;
    const userForm = entityMentionsIn(turns[i]!.content, corpus).find(
      (mention) =>
        sameEntity(mention, fallback) &&
        wordCount(mention) >= wordCount(fallback)
    );
    if (userForm) return userForm;
  }
  return fallback;
};

const leadersOf = (clusters: Cluster[]): Cluster[] => {
  const top = Math.max(...clusters.map((c) => c.count));
  const leaders = clusters.filter((c) => c.count === top);
  if (leaders.length === 1) return leaders;
  const modelled = leaders.filter((c) => c.forms.some(hasModelToken));
  return modelled.length > 0 ? modelled : leaders;
};

const lastUserEntitiesBefore = (
  turns: ConversationTurn[],
  end: number,
  corpus: string
): string[] => {
  for (let i = end - 1; i >= 0; i--) {
    if (turns[i]!.role !== 'user') continue;
    const mentions = entityMentionsIn(turns[i]!.content, corpus);
    if (mentions.length > 0) return mentions;
  }
  return [];
};

const subjectBefore = (
  turns: ConversationTurn[],
  end: number,
  corpus: string
): string | null => {
  for (let i = end - 1; i >= 0; i--) {
    const mentions = entityMentionsIn(turns[i]!.content, corpus);
    if (mentions.length === 0) continue;
    const leaders = leadersOf(clusterMentions(mentions));
    if (leaders.length === 1) {
      return userFormOf(leaders[0]!, turns.slice(0, i + 1), corpus);
    }
    const askedFor =
      turns[i]!.role === 'user'
        ? mentions
        : lastUserEntitiesBefore(turns, i, corpus);
    const compared = leaders.filter((leader) =>
      askedFor.some((entity) => sameEntity(entity, leader.forms[0]!))
    );
    if (compared.length > 0) {
      return compared
        .map((leader) => userFormOf(leader, turns.slice(0, i + 1), corpus))
        .join(' ');
    }
    return (
      subjectBefore(turns, i, corpus) ??
      userFormOf(leaders[0]!, turns.slice(0, i + 1), corpus)
    );
  }
  return null;
};

export const conversationSubject = (
  history: ConversationTurn[]
): string | null => {
  const turns = history.filter(
    (turn) =>
      (turn.role === 'user' || turn.role === 'assistant') && turn.content.trim()
  );
  const corpus = turns.map((turn) => turn.content).join('\n');
  return subjectBefore(turns, turns.length, corpus);
};
