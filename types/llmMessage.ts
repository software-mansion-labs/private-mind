export type LLMMessageRole = 'user' | 'assistant' | 'system';

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
  mediaPath?: string;
}
