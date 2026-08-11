import {
  ChatSettings,
  Message,
  SourceDocument,
  sourceKind,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { CUSTOM_PROMPT_GUARD } from '../constants/prompts';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import {
  estimatePromptTokens,
  getPromptCharBudget,
  getPromptTokenBudget,
} from '../constants/context-window';
import { calendarFacts, mentionsTime } from './calendarFacts';
import {
  detectThreadLanguage,
  type QuestionLanguage,
} from './questionLanguage';
import { detectTopicLanguage } from './web/topicLanguage';

const CONTEXT_CLOSE_TAG_RESERVE_CHARS = 64;

const surrogateSafeEnd = (text: string, end: number): number => {
  if (end <= 0 || end >= text.length) return end;
  const code = text.charCodeAt(end - 1);
  return code >= 0xd800 && code <= 0xdbff ? end - 1 : end;
};

const getContextInstruction = (
  sources?: SourceDocument[],
  preferred?: SourceDocument[],
  language?: QuestionLanguage | null
): string => {
  const hasWeb = !!sources?.some((source) => sourceKind(source) === 'web');
  const hasDocs = !!sources?.some(
    (source) => sourceKind(source) === 'document'
  );
  const webOnly = hasWeb && !hasDocs;

  const headed = 'each block headed by its number and the page title';
  const overviewNote = preferred?.length
    ? ', with a freshly attached file marked "(Overview)"'
    : '';
  const what = webOnly
    ? `excerpts from web pages just retrieved for this question, ${headed}`
    : hasWeb
      ? `excerpts from the user's documents and from web pages just retrieved for this question, ${headed}`
      : `excerpts from the user's documents, ${headed}${overviewNote}`;

  const scope = webOnly
    ? []
    : [
        'Do not answer about any document that is not in the current <context> block, even if it appeared earlier in the chat — its text is not available to you.',
      ];

  const missing = webOnly ? 'the search results' : 'the sources';
  const fallback = `If the block does not contain the answer, say ${missing} contain no information about it; only then may you add what you know, marked as your own knowledge.`;

  const currentTurn = hasWeb
    ? [
        "This block was retrieved for the user's latest message only. Earlier turns may be about a different subject or place — answer the latest message, and never carry a subject over from them.",
      ]
    : [];

  const direct =
    'Answer the question that was asked, directly and first. Do not summarize the pages or add background the question did not ask for.';

  const conflict = hasWeb
    ? [
        'The pages may disagree because some are out of date. Where they conflict, trust the page reporting the newest events — a change, a succession, "X replaces Y" — over a page that states the old fact.',
      ]
    : [];

  const figures =
    'Copy every number, price and date exactly as it is printed in the context. If the context does not state the figure the question asks about, say so — never estimate or invent one.';

  const instruction = [
    'IMPORTANT CONTEXT INFORMATION:',
    `The <context>…</context> block below holds ${what}. It is the ONLY authoritative source for this question — answer strictly from it and prefer it over your own knowledge.`,
    ...currentTurn,
    ...scope,
    fallback,
    direct,
    ...conflict,
    figures,
    languageInstruction(language),
  ].join('\n');

  return `\n\n${instruction}`;
};

const languageInstruction = (language?: QuestionLanguage | null): string => {
  if (!language) {
    return 'Write the whole answer in the language of the latest user message, and do not switch language or script partway through.';
  }
  const inScript = language.script ? `, written in ${language.script}` : '';
  const noLatin = language.script
    ? ' Never transliterate the answer into the Latin alphabet.'
    : '';
  return `Write the whole answer in ${language.name}${inScript} — the language of the question — and do not switch language or script partway through.${noLatin}`;
};

export const answerLanguageAnchor = (
  language: QuestionLanguage | null
): string =>
  language
    ? ` (Answer in ${language.name}.)`
    : ' (Answer in the same language as this message.)';

const getDateInstruction = (
  sources?: SourceDocument[],
  question?: string
): string => {
  const webSources = (sources ?? []).filter(
    (source) => sourceKind(source) === 'web'
  );
  if (webSources.length === 0 && !(question && mentionsTime(question))) {
    return '';
  }
  const language = detectTopicLanguage(webSources);

  return `\n\nCURRENT DATE — from the device clock, correct, and outranking any date found elsewhere:\n${calendarFacts(language?.code)}\nResolve "today", "tomorrow" and weekday names against those lines, quote them exactly, and never ask the user what day it is.`;
};

const getPreferredSourceInstruction = (sources?: SourceDocument[]) => {
  if (!sources?.length) return '';

  const sourceNames = sources.map((source) => source.name).join(', ');
  return `

CURRENT ATTACHMENT PRIORITY:
The user just attached: ${sourceNames}. Treat these as the subject of the question — "this file", "the document", "it" refer to them. Base the answer on them; bring in another source only if they lack the answer. You may still use earlier conversation for continuity.`;
};

export const prepareMessagesForLLM = (
  activeChatMessages: Message[],
  context: string[],
  settings: ChatSettings,
  model: Model,
  customSystemPrompt: string = '',
  preferredSourceDocuments?: SourceDocument[],
  sourceDocuments?: SourceDocument[],
  budgetScale: number = 1
): ExecutorchMessage[] => {
  const hasContext = context.some((chunk) => chunk.trim().length > 0);
  const question = activeChatMessages.findLast(
    (msg) => msg.role === 'user'
  )?.content;
  const language = detectThreadLanguage(
    activeChatMessages
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg.content)
  );

  let systemPrompt = settings.systemPrompt;

  const trimmedCustomPrompt = customSystemPrompt.trim();
  if (trimmedCustomPrompt) {
    const guardedCustomPrompt = `${CUSTOM_PROMPT_GUARD}\n\n${trimmedCustomPrompt}`;
    systemPrompt = systemPrompt
      ? `${systemPrompt}\n\n${guardedCustomPrompt}`
      : guardedCustomPrompt;
  }

  if (hasContext) {
    systemPrompt += getContextInstruction(
      sourceDocuments,
      preferredSourceDocuments,
      language
    );
    systemPrompt += getPreferredSourceInstruction(preferredSourceDocuments);
  } else {
    systemPrompt += `\n\n${languageInstruction(language)}`;
  }
  systemPrompt += getDateInstruction(sourceDocuments, question);

  const nonEventMessages = activeChatMessages.filter(
    (msg): msg is Message & { role: Exclude<Message['role'], 'event'> } =>
      msg.role !== 'event'
  );
  const lastNonEventMessage = nonEventMessages.at(-1);
  const messagesForLLM =
    lastNonEventMessage?.role === 'assistant' &&
    lastNonEventMessage.content.trim().length === 0
      ? nonEventMessages.slice(0, -1)
      : nonEventMessages;

  const filteredMessages: ExecutorchMessage[] = messagesForLLM.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ...(msg.imagePath ? { mediaPath: msg.imagePath } : {}),
  }));

  const messagesWithSystemPrompt: ExecutorchMessage[] = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages,
  ];

  if (messagesWithSystemPrompt.length <= 1) {
    return messagesWithSystemPrompt;
  }

  const lastMessage = messagesWithSystemPrompt.at(-1)!;

  lastMessage.content += answerLanguageAnchor(language);

  if (settings.thinkingEnabled) {
    lastMessage.content += ' /think';
  } else if (model.thinking) {
    lastMessage.content += ' /no_think';
  }

  const budgetSample = `${messagesWithSystemPrompt[0].content}${context.join(
    ' '
  )}${lastMessage.content}`;
  const budgetChars = Math.floor(
    getPromptCharBudget(model, budgetSample) * budgetScale
  );
  const systemChars = messagesWithSystemPrompt[0].content.length;

  if (hasContext) {
    const safeContext = context
      .map((c) => c.replace(/<\s*\/?\s*context\s*>/gi, ''))
      .join(' ');

    const userText = lastMessage.content;
    const groundingHint = preferredSourceDocuments?.length
      ? 'The question is about the just-attached document(s) in the <context> above.'
      : '';
    const conflictHint = sourceDocuments?.some(
      (source) => sourceKind(source) === 'web'
    )
      ? 'If the sources above disagree, the one reporting the newest change (a succession, "X replaces Y") is right — a source stating the older fact is out of date.'
      : '';
    const wrap = (ctx: string) =>
      [`<context>${ctx}</context>`, groundingHint, conflictHint, userText]
        .filter(Boolean)
        .join('\n');

    const availableForLast = Math.max(0, budgetChars - systemChars);
    let finalContext = safeContext;
    if (wrap(finalContext).length > availableForLast) {
      const overhead = wrap('').length;
      const room = Math.max(
        0,
        availableForLast - overhead - CONTEXT_CLOSE_TAG_RESERVE_CHARS
      );
      const hardSlice = safeContext.slice(
        0,
        surrogateSafeEnd(safeContext, room)
      );
      const boundary = Math.max(
        hardSlice.lastIndexOf('\n\n'),
        hardSlice.lastIndexOf('\n ---')
      );
      let sliced = boundary > 0 ? hardSlice.slice(0, boundary) : hardSlice;
      const lastOpenLabel = sliced
        .match(/--- (?!End of )[^:\n]+:/g)
        ?.at(-1)
        ?.slice(4, -1);
      if (
        lastOpenLabel &&
        !sliced.includes(`--- End of ${lastOpenLabel} ---`)
      ) {
        const endMarker = ` \n --- End of ${lastOpenLabel} ---`;
        const allowed =
          room + CONTEXT_CLOSE_TAG_RESERVE_CHARS - endMarker.length;
        if (sliced.length > allowed) {
          sliced = sliced.slice(
            0,
            surrogateSafeEnd(sliced, Math.max(0, allowed))
          );
        }
        finalContext = `${sliced}${endMarker}`;
      } else {
        finalContext = sliced;
      }
    }
    lastMessage.content = wrap(finalContext);
  }

  const mandatoryChars = systemChars + lastMessage.content.length;
  let remainingChars = budgetChars - mandatoryChars;
  const history = messagesWithSystemPrompt.slice(1, -1);
  const keptReversed: ExecutorchMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = history[i].content.length;
    if (remainingChars - cost < 0) {
      break;
    }
    remainingChars -= cost;
    keptReversed.push(history[i]);
  }

  const kept = keptReversed.reverse();
  if (kept.length < history.length) {
    while (kept[0]?.role === 'assistant') {
      kept.shift();
    }
  }

  const finalMessages = [messagesWithSystemPrompt[0], ...kept, lastMessage];

  if (hasContext && budgetScale > 0.75) {
    const assembled = finalMessages.map((msg) => msg.content).join(' ');
    if (estimatePromptTokens(assembled) > getPromptTokenBudget(model)) {
      return prepareMessagesForLLM(
        activeChatMessages,
        context,
        settings,
        model,
        customSystemPrompt,
        preferredSourceDocuments,
        sourceDocuments,
        budgetScale * 0.97
      );
    }
  }

  return finalMessages;
};
