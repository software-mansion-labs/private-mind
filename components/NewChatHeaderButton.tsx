import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import ChatIcon from '../assets/icons/chat.svg';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { startPhantomChat } from '../utils/startPhantomChat';
import { useChatStore } from '../store/chatStore';
import { useTurnInFlight } from '../hooks/useTurnInFlight';
import { useSteadyFlag } from '../hooks/useSteadyFlag';
import { showTurnInFlightNotice } from '../utils/turnInFlightNotice';
import { TURN_IN_FLIGHT_HOLD_MS } from '../constants/header-actions';
import HeaderActionIcon from './HeaderActionIcon';
import HeaderGlassButton, { headerGlassButtonFill } from './HeaderGlassButton';

interface Props {
  noOp?: boolean;
  glass?: boolean;
}

const NewChatHeaderButton = ({ noOp = false, glass = false }: Props) => {
  const db = useSQLiteContext();
  const { styles, theme } = useThemedStyles(createStyles);

  const turnInFlight = useTurnInFlight();
  const looksBusy = useSteadyFlag(turnInFlight, TURN_IN_FLIGHT_HOLD_MS);

  const handlePress = () => {
    if (turnInFlight) {
      showTurnInFlightNotice();
      return;
    }
    if (noOp) {
      useChatStore.getState().startBlankChat();
      return;
    }
    startPhantomChat(db, 'replace');
  };

  const button = (
    <TouchableOpacity
      onPress={handlePress}
      style={glass ? headerGlassButtonFill : styles.button}
      hitSlop={15}
      testID="new-chat-header-button"
    >
      <HeaderActionIcon
        icon={ChatIcon}
        width={20}
        height={20}
        color={theme.text.primary}
        dimmed={looksBusy}
      />
    </TouchableOpacity>
  );

  if (!glass) return button;

  return <HeaderGlassButton edge="trailing">{button}</HeaderGlassButton>;
};

export default NewChatHeaderButton;

const createStyles = () =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
  });
