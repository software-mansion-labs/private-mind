export const CHAT_MENU_OPTIONS = [
  'Rename',
  'Export Chat',
  'Delete Chat',
  'Cancel',
];

export const CHAT_MENU_RENAME_INDEX = 0;
export const CHAT_MENU_EXPORT_INDEX = 1;
export const CHAT_MENU_DELETE_INDEX = 2;
export const CHAT_MENU_CANCEL_INDEX = 3;

export const CHAT_MENU_TITLE_MAX_LENGTH = 32;

export const getChatMenuTitle = (label: string) =>
  label.length > CHAT_MENU_TITLE_MAX_LENGTH
    ? `${label.slice(0, CHAT_MENU_TITLE_MAX_LENGTH).trimEnd()}…`
    : label;
