import {
  ChatSettings,
  Message,
  SourceDocument,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { CUSTOM_PROMPT_GUARD } from '../constants/prompts';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { getPromptCharBudget } from '../constants/context-window';

const CONTEXT_INSTRUCTION = `

IMPORTANT CONTEXT INFORMATION:
The <context>…</context> block below holds excerpts from the user's documents ("Source N: <name>", or "(Overview)" for a freshly attached file). It is the ONLY authoritative source for this question — answer strictly from it and prefer it over your own knowledge.
Do not answer about any document that is not in the current <context> block, even if it appeared earlier in the chat.
If the block does not contain the answer, say "I don't know".`;

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
  preferredSourceDocuments?: SourceDocument[]
): ExecutorchMessage[] => {
  let systemPrompt = settings.systemPrompt;

  const trimmedCustomPrompt = customSystemPrompt.trim();
  if (trimmedCustomPrompt) {
    const guardedCustomPrompt = `${CUSTOM_PROMPT_GUARD}\n\n${trimmedCustomPrompt}`;
    systemPrompt = systemPrompt
      ? `${systemPrompt}\n\n${guardedCustomPrompt}`
      : guardedCustomPrompt;
  }

  if (context.length > 0) {
    systemPrompt += CONTEXT_INSTRUCTION;
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

  if (context.length > 0) {
    const safeContext = context
      .map((c) => c.replace(/<\/context>/gi, ''))
      .join(' ');

    const userText = lastMessage.content;
    const groundingHint = preferredSourceDocuments?.length
      ? `\nAnswer only about the document(s) in the <context> above. Ignore any document mentioned earlier in the chat that is not in it.`
      : '';
    const wrap = (ctx: string) => `<context>${ctx}</context>${groundingHint}
        ${userText}
        `;

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
      finalContext = boundary > 0 ? hardSlice.slice(0, boundary) : hardSlice;
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

  return [messagesWithSystemPrompt[0], ...keptReversed.reverse(), lastMessage];
};
