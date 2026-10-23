import React, { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useChatActions } from '../../hooks/useChatActions';
import { chatLabel } from '../../utils/chatLabel';
import { Feedback } from '../../utils/Feedback';
import ChatTitlePopover from './ChatTitlePopover';

interface Options {
  chatId: number;
  chatTitle: string;
  anchorTop?: number;
}

export const useChatTitleMenu = ({ chatId, chatTitle, anchorTop }: Options) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuTitle = chatLabel({ id: chatId, title: chatTitle });

  const { rename, exportChat, confirmDelete, ConfirmElement } = useChatActions({
    onDeleted: () => router.replace('/'),
  });

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const openMenu = useCallback(() => {
    Keyboard.dismiss();
    Feedback.sheetOpen();
    setIsOpen(true);
  }, []);

  const handleRename = useCallback(
    (newTitle: string) => rename(chatId, newTitle),
    [chatId, rename]
  );

  const handleShare = useCallback(() => {
    setIsOpen(false);
    exportChat(chatId, chatTitle);
  }, [exportChat, chatId, chatTitle]);

  const handleDelete = useCallback(() => {
    setIsOpen(false);
    confirmDelete(chatId);
  }, [confirmDelete, chatId]);

  const MenuElements = (
    <>
      <ChatTitlePopover
        visible={isOpen}
        anchorTop={anchorTop ?? 0}
        title={menuTitle}
        onRename={handleRename}
        onShare={handleShare}
        onDelete={handleDelete}
        onClose={closeMenu}
      />
      {ConfirmElement}
    </>
  );

  return { openMenu, isOpen, menuTitle, MenuElements };
};
