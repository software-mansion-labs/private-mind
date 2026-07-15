import React, { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Chat } from '../../database/chatRepository';
import { useChatActions } from '../../hooks/useChatActions';
import { Feedback } from '../../utils/Feedback';
import { chatLabel } from '../../utils/chatLabel';
import RenameChatModal from '../chat-screen/RenameChatModal';
import ChatTitleMenuSheet from '../chat-screen/ChatTitleMenuSheet';
import {
  CHAT_MENU_CANCEL_INDEX,
  CHAT_MENU_DELETE_INDEX,
  CHAT_MENU_EXPORT_INDEX,
  CHAT_MENU_OPTIONS,
  CHAT_MENU_RENAME_INDEX,
  getChatMenuTitle,
} from '../../constants/chat-menu';

type Options = {
  onMenuActiveChange?: (active: boolean) => void;
};

export const useDrawerChatMenu = ({ onMenuActiveChange }: Options = {}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [targetChat, setTargetChat] = useState<Chat | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const androidSheetRef = useRef<BottomSheetModal>(null);
  const actionPendingRef = useRef(false);

  const { rename, exportChat, confirmDelete, ConfirmElement } = useChatActions({
    onDeleted: (chatId) => {
      if (pathname === `/chat/${chatId}`) {
        router.replace('/');
      }
    },
  });

  const setMenuActive = useCallback(
    (active: boolean) => onMenuActiveChange?.(active),
    [onMenuActiveChange]
  );

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      actionPendingRef.current = true;
      try {
        await action();
      } finally {
        actionPendingRef.current = false;
        setMenuActive(false);
      }
    },
    [setMenuActive]
  );

  const openMenuFor = useCallback(
    (chat: Chat) => {
      setTargetChat(chat);
      setMenuActive(true);

      if (Platform.OS === 'ios') {
        Feedback.sheetOpen();
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: getChatMenuTitle(chatLabel(chat)),
            options: CHAT_MENU_OPTIONS,
            destructiveButtonIndex: CHAT_MENU_DELETE_INDEX,
            cancelButtonIndex: CHAT_MENU_CANCEL_INDEX,
          },
          (index) => {
            if (index === CHAT_MENU_RENAME_INDEX) {
              setRenameVisible(true);
            } else if (index === CHAT_MENU_EXPORT_INDEX) {
              runAction(() => exportChat(chat.id, chatLabel(chat)));
            } else if (index === CHAT_MENU_DELETE_INDEX) {
              runAction(() => confirmDelete(chat.id));
            } else {
              setMenuActive(false);
            }
          }
        );
      } else {
        androidSheetRef.current?.present();
      }
    },
    [exportChat, confirmDelete, runAction, setMenuActive]
  );

  const handleRenameSubmit = useCallback(
    async (newTitle: string) => {
      setRenameVisible(false);
      setMenuActive(false);
      if (!targetChat) return;
      await rename(targetChat.id, newTitle);
    },
    [rename, targetChat, setMenuActive]
  );

  const handleRenameCancel = useCallback(() => {
    setRenameVisible(false);
    setMenuActive(false);
  }, [setMenuActive]);

  const MenuElements = (
    <>
      {Platform.OS === 'android' && (
        <ChatTitleMenuSheet
          bottomSheetModalRef={androidSheetRef}
          title={targetChat ? getChatMenuTitle(chatLabel(targetChat)) : ''}
          onRename={() => setRenameVisible(true)}
          onExport={() => {
            if (targetChat)
              runAction(() => exportChat(targetChat.id, chatLabel(targetChat)));
          }}
          onDelete={() => {
            if (targetChat) runAction(() => confirmDelete(targetChat.id));
          }}
          onDismiss={() => {
            if (!renameVisible && !actionPendingRef.current) {
              setMenuActive(false);
            }
          }}
        />
      )}
      {ConfirmElement}
      <RenameChatModal
        visible={renameVisible}
        initialTitle={targetChat ? chatLabel(targetChat) : ''}
        onCancel={handleRenameCancel}
        onSubmit={handleRenameSubmit}
      />
    </>
  );

  return { openMenuFor, MenuElements };
};
