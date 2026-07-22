import React, { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Platform } from 'react-native';
import { router } from 'expo-router';
import type { AppBottomSheetRef } from '../bottomSheets/AppBottomSheet';
import { useChatActions } from '../../hooks/useChatActions';
import { chatLabel } from '../../utils/chatLabel';
import RenameChatModal from './RenameChatModal';
import ChatTitleMenuSheet from './ChatTitleMenuSheet';
import {
  CHAT_MENU_CANCEL_INDEX,
  CHAT_MENU_DELETE_INDEX,
  CHAT_MENU_EXPORT_INDEX,
  CHAT_MENU_OPTIONS,
  CHAT_MENU_RENAME_INDEX,
  getChatMenuTitle,
} from '../../constants/chat-menu';

interface Options {
  chatId: number;
  chatTitle: string;
}

export const useChatTitleMenu = ({ chatId, chatTitle }: Options) => {
  const [renameVisible, setRenameVisible] = useState(false);
  const androidSheetRef = useRef<AppBottomSheetRef>(null);

  const menuTitle = getChatMenuTitle(
    chatLabel({ id: chatId, title: chatTitle })
  );

  const { rename, exportChat, confirmDelete, ConfirmElement } = useChatActions({
    onDeleted: () => router.replace('/'),
  });

  const handleRenameSubmit = useCallback(
    async (newTitle: string) => {
      setRenameVisible(false);
      await rename(chatId, newTitle);
    },
    [chatId, rename]
  );

  const handleExport = useCallback(
    () => exportChat(chatId, chatTitle),
    [exportChat, chatId, chatTitle]
  );

  const handleDelete = useCallback(
    () => confirmDelete(chatId),
    [confirmDelete, chatId]
  );

  const openMenu = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: menuTitle,
          options: CHAT_MENU_OPTIONS,
          destructiveButtonIndex: CHAT_MENU_DELETE_INDEX,
          cancelButtonIndex: CHAT_MENU_CANCEL_INDEX,
        },
        (index) => {
          if (index === CHAT_MENU_RENAME_INDEX) setRenameVisible(true);
          else if (index === CHAT_MENU_EXPORT_INDEX) handleExport();
          else if (index === CHAT_MENU_DELETE_INDEX) handleDelete();
        }
      );
    } else {
      androidSheetRef.current?.present();
    }
  }, [menuTitle, handleExport, handleDelete]);

  const MenuElements = (
    <>
      {Platform.OS === 'android' && (
        <ChatTitleMenuSheet
          bottomSheetModalRef={androidSheetRef}
          title={menuTitle}
          onRename={() => setRenameVisible(true)}
          onExport={handleExport}
          onDelete={handleDelete}
        />
      )}
      {ConfirmElement}
      <RenameChatModal
        visible={renameVisible}
        initialTitle={chatTitle}
        onCancel={() => setRenameVisible(false)}
        onSubmit={handleRenameSubmit}
      />
    </>
  );

  return { openMenu, MenuElements };
};
