export const CHAT_ENTRY_ANIMATION = {
  BranchCreated: 'branch-created',
} as const;

export type ChatEntryAnimation =
  (typeof CHAT_ENTRY_ANIMATION)[keyof typeof CHAT_ENTRY_ANIMATION];
