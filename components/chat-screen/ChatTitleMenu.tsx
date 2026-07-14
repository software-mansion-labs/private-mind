import React, { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Platform } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useChatActions } from '../../hooks/useChatActions';
import RenameChatModal from './RenameChatModal';
import ChatTitleMenuSheet from './ChatTitleMenuSheet';

interface Options {
  chatId: number;
  chatTitle: string;
}

const SHEET_TITLE = 'Chat';

export const useChatTitleMenu = ({ chatId, chatTitle }: Options) => {
  const [renameVisible, setRenameVisible] = useState(false);
  const androidSheetRef = useRef<BottomSheetModal>(null);

  const { rename, exportChat, confirmDelete } = useChatActions({
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
          title: SHEET_TITLE,
          options: ['Rename', 'Export Chat', 'Delete Chat', 'Cancel'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index === 0) setRenameVisible(true);
          else if (index === 1) handleExport();
          else if (index === 2) handleDelete();
        }
      );
    } else {
      androidSheetRef.current?.present();
    }
  }, [handleExport, handleDelete]);

  const MenuElements = (
    <>
      {Platform.OS === 'android' && (
        <ChatTitleMenuSheet
          bottomSheetModalRef={androidSheetRef}
          onRename={() => setRenameVisible(true)}
          onExport={handleExport}
          onDelete={handleDelete}
        />
      )}
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
