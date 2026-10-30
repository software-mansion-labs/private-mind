import React, { useCallback, useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatActions } from '../../hooks/useChatActions';
import { chatLabel, toChatTitle } from '../../utils/chatLabel';
import { Feedback } from '../../utils/Feedback';
import ChatMenuPopover from './ChatMenuPopover';
import { MenuPlacement, MenuTarget, chooseSide } from './placement';

interface MenuChat {
  id: number;
  title: string;
}

interface OpenMenu {
  chat: MenuChat;
  placement: MenuPlacement;
}

interface Options {
  onActiveChange?: (active: boolean) => void;
}

export const useChatMenu = ({ onActiveChange }: Options = {}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { rename, exportChat, confirmDelete, ConfirmElement } = useChatActions({
    onDeleted: (chatId) => {
      if (pathname === `/chat/${chatId}`) router.replace('/');
    },
  });

  const openMenu = useCallback(
    (chat: MenuChat, target: MenuTarget) => {
      Keyboard.dismiss();
      Feedback.sheetOpen();
      onActiveChange?.(true);
      setMenu({
        chat,
        placement: { target, side: chooseSide(target, windowHeight, insets) },
      });
      setIsOpen(true);
    },
    [onActiveChange, windowHeight, insets]
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onActiveChange?.(false);
  }, [onActiveChange]);

  const closeForAction = useCallback(
    async (action: () => Promise<void>) => {
      setIsOpen(false);
      try {
        await action();
      } finally {
        onActiveChange?.(false);
      }
    },
    [onActiveChange]
  );

  const chat = menu?.chat;

  const handleRename = useCallback(
    (newTitle: string) => {
      if (!chat) return;
      setMenu(
        (open) =>
          open && {
            ...open,
            chat: { ...open.chat, title: toChatTitle(newTitle) },
          }
      );
      rename(chat.id, newTitle);
    },
    [chat, rename]
  );

  const handleShare = useCallback(() => {
    if (chat) closeForAction(() => exportChat(chat.id, chatLabel(chat)));
  }, [chat, closeForAction, exportChat]);

  const handleDelete = useCallback(() => {
    if (chat) closeForAction(() => confirmDelete(chat.id));
  }, [chat, closeForAction, confirmDelete]);

  const MenuElements = (
    <>
      {menu && (
        <ChatMenuPopover
          visible={isOpen}
          placement={menu.placement}
          title={chatLabel(menu.chat)}
          onRename={handleRename}
          onShare={handleShare}
          onDelete={handleDelete}
          onClose={closeMenu}
        />
      )}
      {ConfirmElement}
    </>
  );

  return {
    openMenu,
    openChatId: isOpen ? (chat?.id ?? null) : null,
    MenuElements,
  };
};
