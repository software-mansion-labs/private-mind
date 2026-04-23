import { ChatSettings, Message } from '../database/chatRepository';
import { Model } from '../database/modelRepository';
import { type Message as ExecutorchMessage } from 'react-native-executorch';

const CONTEXT_INSTRUCTION = `
IMPORTANT CONTEXT INFORMATION:
You have access to relevant information from the user's document sources. Use this context to provide accurate, well-informed responses. Always prioritize information from the provided context when it's relevant to the user's question.

Instructions for using context:
- The context is delimited by <context> and </context> tags
- Refer to the context information when answering questions
- If the context directly addresses the user's question, use that information as the primary basis for your response
- If information from context conflicts with your general knowledge, prioritize the context
- If the context doesn't contain relevant information say "I don't know" or "The provided context does not contain the information"
- When citing information from context, you can reference it naturally without formal citations`;

export const prepareMessagesForLLM = (
  activeChatMessages: Message[],
  context: string[],
  settings: ChatSettings,
  model: Model
): ExecutorchMessage[] => {
  let systemPrompt = settings.systemPrompt;

  if (context.length > 0) {
    systemPrompt += CONTEXT_INSTRUCTION;
  }

  const filteredMessages: ExecutorchMessage[] = activeChatMessages
    .filter((msg) => msg.role !== 'event')
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.imagePath ? { mediaPath: msg.imagePath } : {}),
    }));

  const messagesWithSystemPrompt: ExecutorchMessage[] = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages,
  ];

  const lastMessage = messagesWithSystemPrompt.at(-1);

  if (!lastMessage) {
    return messagesWithSystemPrompt;
  }

  if (settings.thinkingEnabled) {
    lastMessage.content += ' /think';
  } else if (model.thinking) {
    lastMessage.content += ' /no_think';
  }

  if (context.length > 0) {
    // Strip any nested </context> in source chunks — otherwise a document
    // containing the literal closing tag (e.g. an HTML export) would close
    // the delimiter early and the rest would be parsed as user instruction.
    const safeContext = context
      .map((c) => c.replace(/<\/context>/gi, ''))
      .join(' ');
    lastMessage.content = `<context>${safeContext}</context>
        ${lastMessage.content}
        `;
  }

  return messagesWithSystemPrompt;
};
