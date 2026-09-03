import { foldForMatching } from '../queryTerms';
import { type ConversationTurn, namedEntitiesIn } from './conversationSubject';
import { sharedStemCount } from './queryLanguage';

const ACRONYM =
  /(?<![\p{L}\p{N}])(?:\p{Lu}{2,}(?:-\p{Lu}+)?|\p{N}{1,2}\p{Lu}{1,2})(?![\p{L}\p{N}])/gu;
const ANCHOR_MIN_MENTIONS = 2;
const ANCHORS_MAX = 2;

const outsideNames = (text: string): string =>
  namedEntitiesIn(text).reduce(
    (rest, entity) => rest.split(entity).join(' '),
    text
  );

const acronymsIn = (text: string): string[] =>
  [...outsideNames(text).matchAll(ACRONYM)].map((match) => match[0]);

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mentions = (text: string, token: string): boolean =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(foldForMatching(token))}(?![\\p{L}\\p{N}])`,
    'u'
  ).test(foldForMatching(outsideNames(text)));

const spokenTurns = (history: ConversationTurn[]): ConversationTurn[] =>
  history.filter(
    (turn) =>
      (turn.role === 'user' || turn.role === 'assistant') &&
      turn.content.trim().length > 0
  );

export const topicAnchors = (
  history: ConversationTurn[],
  digest = ''
): string[] => {
  const turns = spokenTurns(history);
  const userTurns = turns.filter((turn) => turn.role === 'user');
  const corpus = [digest, ...turns.map((turn) => turn.content)].join('\n');
  const candidates = [...new Set(acronymsIn(corpus).map(foldForMatching))];
  return candidates
    .map((token) => {
      const byUser = userTurns.filter((turn) =>
        mentions(turn.content, token)
      ).length;
      const inDigest = mentions(digest, token) ? 1 : 0;
      return { token, byUser, weight: byUser + inDigest };
    })
    .filter(
      (anchor) => anchor.byUser > 0 && anchor.weight >= ANCHOR_MIN_MENTIONS
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, ANCHORS_MAX)
    .map((anchor) => anchor.token.toUpperCase());
};

const standsAlone = (message: string): boolean =>
  namedEntitiesIn(message).length > 0 ||
  /\p{N}/u.test(message) ||
  acronymsIn(message).length > 0;

export const topicAnchorer = (
  latestMessage: string,
  history: ConversationTurn[],
  digest = ''
): ((query: string) => string) => {
  if (standsAlone(latestMessage)) return (query) => query;
  const anchors = topicAnchors(history, digest);
  if (anchors.length === 0) return (query) => query;
  const anchoredTurns = spokenTurns(history)
    .filter((turn) => anchors.some((anchor) => mentions(turn.content, anchor)))
    .map((turn) => turn.content);
  const topicText = [digest, ...anchoredTurns].join('\n');
  return (query) => {
    const folded = foldForMatching(query);
    if (anchors.some((anchor) => folded.includes(foldForMatching(anchor))))
      return query;
    if (sharedStemCount(query, topicText) === 0) return query;
    return `${query} ${anchors.join(' ')}`;
  };
};
