export const CHAT_ENTRY_ANIMATION = {
  BranchCreated: 'branch-created',
} as const;

export type ChatEntryAnimation =
  (typeof CHAT_ENTRY_ANIMATION)[keyof typeof CHAT_ENTRY_ANIMATION];

export const CHAT_ENTRY_ACTION = {
  PickModel: 'pick-model',
} as const;

export type ChatEntryAction =
  (typeof CHAT_ENTRY_ACTION)[keyof typeof CHAT_ENTRY_ACTION];
