import { Message } from '../database/chatRepository';
import { getSourceLinkingBoundary } from './sourceLinkingBoundary';

// Negative synthetic id, distinct from real ids and the -1 stream placeholder.
export const LEGACY_CHAT_WARNING_MESSAGE_ID = -100;

// True when a legacy document (attached before the boundary) is present but no
// message carries sourceDocuments. The boundary excludes new interrupted uploads.
export const chatPredatesSourceLinking = (
  messages: Message[],
  boundaryMessageId: number = getSourceLinkingBoundary()
): boolean => {
  const usedLegacyDocument = messages.some(
    (message) => !!message.documentName && message.id <= boundaryMessageId
  );
  if (!usedLegacyDocument) return false;

  const hasSourceLinking = messages.some(
    (message) => !!message.sourceDocuments && message.sourceDocuments.length > 0
  );
  return !hasSourceLinking;
};

export const buildLegacyChatWarningMessage = (chatId: number): Message => ({
  id: LEGACY_CHAT_WARNING_MESSAGE_ID,
  chatId,
  role: 'event',
  content:
    'Note: this conversation predates document linking, so its attached document is no longer available here. Attach it again in a new chat to use it as a source.',
  timestamp: 0,
});
