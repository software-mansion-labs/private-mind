import {
  ChatSettings,
  Message,
  SourceDocument,
} from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';
import { getPromptCharBudget } from '../constants/context-window';

const CONTEXT_INSTRUCTION = `
IMPORTANT CONTEXT INFORMATION:
You have access to relevant excerpts from the user's document sources. Use this context to provide accurate, well-informed responses. Always prioritize information from the provided context when it's relevant to the user's question.

Instructions for using context:
- The context is delimited by <context> and </context> tags
- Retrieved passages are labeled "Source N: <document name>"; a freshly attached document's overview is labeled "Current Attachment Source: <document name> (Overview)"
- The <context> block is the ONLY authoritative source for the current question. Answer strictly from the excerpts inside it.
- Do NOT describe, summarize, or answer about any document that is not present in the current <context> block, even if it was discussed or attached in an earlier turn of this conversation. Earlier turns are for conversational continuity only, not a source of document facts.
- If information from context conflicts with your general knowledge, prioritize the context
- If the context doesn't contain relevant information say "I don't know" or "The provided context does not contain the information"`;

const getPreferredSourceInstruction = (sources?: SourceDocument[]) => {
  if (!sources?.length) return '';

  const sourceNames = sources.map((source) => source.name).join(', ');
  return `

CURRENT ATTACHMENT PRIORITY:
The user just attached these document sources to the current message: ${sourceNames}.
They are the primary subject of the latest question. When the user says "this file", "the document", "the file", "it" or asks about a format, they mean these current attachment sources — never a document that only appeared earlier in the conversation.
Base your answer on the documents present in the <context> block below. Only bring in another source when these attachment sources do not contain the answer, or the user's question explicitly asks about a different document.
You may still use earlier conversation for continuity when it does not conflict with the current attachment sources.`;
};

export const prepareMessagesForLLM = (
  activeChatMessages: Message[],
  context: string[],
  settings: ChatSettings,
  model: Model,
  preferredSourceDocuments?: SourceDocument[]
): ExecutorchMessage[] => {
  let systemPrompt = settings.systemPrompt;

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
      finalContext = safeContext.slice(0, room);
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

  return [
    messagesWithSystemPrompt[0],
    ...keptReversed.reverse(),
    lastMessage,
  ];
};
