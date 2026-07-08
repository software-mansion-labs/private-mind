import { Message } from '../database/chatRepository';
import { getSourceLinkingBoundary } from './sourceLinkingBoundary';

export type LegacyChatDiagnosis = {
  hasLegacyDocument: boolean;
  hasSourceLinking: boolean;
  isLegacy: boolean;
};

// Both checks are scoped to the pre-boundary era (id <= boundary) on purpose: a
// new turn that retrieves a source (id > boundary) must not flip a legacy chat to
// "linked" and drop the notice mid-conversation.
export const diagnoseLegacyChat = (
  messages: Message[],
  boundaryMessageId: number = getSourceLinkingBoundary()
): LegacyChatDiagnosis => {
  const hasLegacyDocument = messages.some(
    (message) => !!message.documentName && message.id <= boundaryMessageId
  );
  const hasSourceLinking = messages.some(
    (message) =>
      message.id <= boundaryMessageId &&
      !!message.sourceDocuments &&
      message.sourceDocuments.length > 0
  );
  return {
    hasLegacyDocument,
    hasSourceLinking,
    isLegacy: hasLegacyDocument && !hasSourceLinking,
  };
};

export const chatPredatesSourceLinking = (
  messages: Message[],
  boundaryMessageId: number = getSourceLinkingBoundary()
): boolean => diagnoseLegacyChat(messages, boundaryMessageId).isLegacy;
