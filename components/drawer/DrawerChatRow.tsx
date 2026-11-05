import React, { memo, useCallback } from 'react';
import { Chat } from '../../database/chatRepository';
import { chatLabel } from '../../utils/chatLabel';
import { DrawerItem, WindowRect } from './DrawerItem';

interface Props {
  chat: Chat;
  active: boolean;
  highlighted: boolean;
  onOpen: (chatId: number) => void;
  onOpenMenu: (chat: Chat, rect: WindowRect) => void;
}

export const DrawerChatRow = memo(
  ({ chat, active, highlighted, onOpen, onOpenMenu }: Props) => {
    const handlePress = useCallback(() => onOpen(chat.id), [onOpen, chat.id]);
    const handleLongPress = useCallback(
      (rect: WindowRect) => onOpenMenu(chat, rect),
      [onOpenMenu, chat]
    );

    return (
      <DrawerItem
        variant="chat"
        testID={`drawer-chat-${chat.id}`}
        label={chatLabel(chat)}
        active={active}
        highlighted={highlighted}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    );
  }
);

DrawerChatRow.displayName = 'DrawerChatRow';
