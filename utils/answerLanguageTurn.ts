import type { LLMMessage } from '../types/llmMessage';
import type { QuestionLanguage } from './questionLanguage';

const UNNAMED_LANGUAGE_INSTRUCTION =
  "(Answer in the same language as the user's latest message.)";

export const answerLanguageTurn = (
  language: QuestionLanguage | null
): LLMMessage => ({
  role: 'system',
  content: language
    ? `(Answer in ${language.name}.)`
    : UNNAMED_LANGUAGE_INSTRUCTION,
});

const endsWithAnswerLanguageTurn = (messages: LLMMessage[]): boolean =>
  messages.length > 1 && messages.at(-1)!.role === 'system';

export const withoutAnswerLanguageTurn = (
  messages: LLMMessage[]
): LLMMessage[] =>
  endsWithAnswerLanguageTurn(messages) ? messages.slice(0, -1) : messages;

export const withAnswerLanguageTurn = (
  messages: LLMMessage[],
  language: QuestionLanguage | null
): LLMMessage[] => [
  ...withoutAnswerLanguageTurn(messages),
  answerLanguageTurn(language),
];

export const questionTurnOf = (
  messages: LLMMessage[]
): LLMMessage | undefined => withoutAnswerLanguageTurn(messages).at(-1);
