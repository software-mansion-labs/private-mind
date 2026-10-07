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
import { hitSlop, iconSize, opacity } from '../constants/design-system';

interface Props {
  noOp?: boolean;
}

const NewChatHeaderButton = ({ noOp = false }: Props) => {
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

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.button}
      hitSlop={hitSlop}
      activeOpacity={opacity.pressed}
      testID="new-chat-header-button"
    >
      <HeaderActionIcon
        icon={ChatIcon}
        width={iconSize.md}
        height={iconSize.md}
        color={theme.text.primary}
        dimmed={looksBusy}
      />
    </TouchableOpacity>
  );
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
