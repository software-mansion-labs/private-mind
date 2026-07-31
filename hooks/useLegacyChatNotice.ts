import { useEffect, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { useDrawerStatus } from '@react-navigation/drawer';
import { useTheme } from '../context/ThemeContext';
import { Message } from '../database/chatRepository';
import { diagnoseLegacyChat } from '../utils/legacyChat';
import { LEGACY_CHAT_NOTICE_TOP_OFFSET } from '../constants/chat';

export const useLegacyChatNotice = (messageHistory: Message[]): void => {
  const { theme } = useTheme();
  const isDrawerOpen = useDrawerStatus() === 'open';
  const isLegacy = useMemo(
    () => diagnoseLegacyChat(messageHistory).isLegacy,
    [messageHistory]
  );
  const show = isLegacy && !isDrawerOpen;

  useEffect(() => {
    if (!show) return;
    Toast.show({
      type: 'defaultToast',
      text1:
        'Note: this conversation predates document linking, so its attached document is no longer available here. Attach it again in a new chat to use it as a source.',
      autoHide: false,
      topOffset: theme.insets.top + LEGACY_CHAT_NOTICE_TOP_OFFSET,
    });
    return () => Toast.hide();
  }, [show, theme.insets.top]);
};
