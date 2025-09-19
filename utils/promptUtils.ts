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
    systemPrompt = systemPrompt + CONTEXT_INSTRUCTION;
  }

  const filteredMessages: ExecutorchMessage[] = activeChatMessages.reduce(
    (acc: ExecutorchMessage[], msg) => {
      if (msg.role !== 'event') {
        acc.push({ role: msg.role, content: msg.content });
      }
      return acc;
    },
    []
  );

  const messagesWithSystemPrompt: ExecutorchMessage[] = [
    { role: 'system', content: systemPrompt },
    ...filteredMessages.slice(-settings.contextWindow, -1),
  ];

  const lastMessage = messagesWithSystemPrompt.at(-1);

  if (settings.thinkingEnabled) {
    lastMessage!.content += ' /think';
  } else if (model.thinking) {
    lastMessage!.content += ' /no_think';
  }

  if (context.length > 0) {
    lastMessage!.content = `<context>${context.join(' ')}</context>
        ${lastMessage!.content}
        `;
  }

  return messagesWithSystemPrompt;
};
