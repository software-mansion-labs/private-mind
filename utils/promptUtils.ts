import {
  ChatSettings,
  Message,
  SourceDocument,
  sourceKind,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { CUSTOM_PROMPT_GUARD } from '../constants/prompts';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { getPromptCharBudget } from '../constants/context-window';

const getContextInstruction = (
  sources?: SourceDocument[],
  preferred?: SourceDocument[]
): string => {
  const hasWeb = !!sources?.some((source) => sourceKind(source) === 'web');
  const hasDocs = !!sources?.some(
    (source) => sourceKind(source) === 'document'
  );
  const webOnly = hasWeb && !hasDocs;

  const overviewNote = preferred?.length
    ? ', or "(Overview)" for a freshly attached file'
    : '';
  const what = webOnly
    ? 'excerpts from web pages just retrieved for this question ("Source N: <name>")'
    : hasWeb
      ? 'excerpts from the user\'s documents and from web pages just retrieved for this question ("Source N: <name>")'
      : `excerpts from the user's documents ("Source N: <name>"${overviewNote})`;

  const scope = webOnly
    ? []
    : [
        'Do not answer about any document that is not in the current <context> block, even if it appeared earlier in the chat — its text is not available to you.',
      ];

  const missing = webOnly ? 'the search results' : 'the sources';
  const fallback = `If the block does not contain the answer, say ${missing} contain no information about it; only then may you add what you know, marked as your own knowledge.`;

  const instruction = [
    'IMPORTANT CONTEXT INFORMATION:',
    `The <context>…</context> block below holds ${what}. It is the ONLY authoritative source for this question — answer strictly from it and prefer it over your own knowledge.`,
    ...scope,
    fallback,
  ].join('\n');

  return `\n\n${instruction}`;
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
  sourceDocuments?: SourceDocument[]
): ExecutorchMessage[] => {
  const hasContext = context.some((chunk) => chunk.trim().length > 0);

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
      preferredSourceDocuments
    );
    systemPrompt += getPreferredSourceInstruction(preferredSourceDocuments);
  }

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

  if (settings.thinkingEnabled) {
    lastMessage.content += ' /think';
  } else if (model.thinking) {
    lastMessage.content += ' /no_think';
  }

  const budgetChars = getPromptCharBudget(model);
  const systemChars = messagesWithSystemPrompt[0].content.length;

  if (hasContext) {
    const safeContext = context
      .map((c) => c.replace(/<\s*\/?\s*context\s*>/gi, ''))
      .join(' ');

    const userText = lastMessage.content;
    const groundingHint = preferredSourceDocuments?.length
      ? 'The question is about the just-attached document(s) in the <context> above.'
      : '';
    const wrap = (ctx: string) =>
      [`<context>${ctx}</context>`, groundingHint, userText]
        .filter(Boolean)
        .join('\n');

    const availableForLast = Math.max(0, budgetChars - systemChars);
    let finalContext = safeContext;
    if (wrap(finalContext).length > availableForLast) {
      const overhead = wrap('').length;
      const room = Math.max(0, availableForLast - overhead);
      const hardSlice = safeContext.slice(0, room);
      const boundary = Math.max(
        hardSlice.lastIndexOf('\n\n'),
        hardSlice.lastIndexOf('\n ---')
      );
      const sliced = boundary > 0 ? hardSlice.slice(0, boundary) : hardSlice;
      const lastOpenLabel = sliced
        .match(/--- (?!End of )[^:\n]+:/g)
        ?.at(-1)
        ?.slice(4, -1);
      finalContext =
        lastOpenLabel && !sliced.includes(`--- End of ${lastOpenLabel} ---`)
          ? `${sliced} \n --- End of ${lastOpenLabel} ---`
          : sliced;
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

  return [messagesWithSystemPrompt[0], ...kept, lastMessage];
};
