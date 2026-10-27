import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import ChatIcon from '../assets/icons/chat.svg';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Feedback } from '../utils/Feedback';
import { startPhantomChat } from '../utils/startPhantomChat';
import { useChatStore } from '../store/chatStore';
import { pressedOpacity } from '../styles/pressable';
import { useTurnInFlight } from '../hooks/useTurnInFlight';
import { useSteadyFlag } from '../hooks/useSteadyFlag';
import { showTurnInFlightNotice } from '../utils/turnInFlightNotice';
import { TURN_IN_FLIGHT_HOLD_MS } from '../constants/header-actions';
import HeaderActionIcon from './HeaderActionIcon';
import HeaderGlassButton, { headerGlassButtonFill } from './HeaderGlassButton';
import { space } from '../constants/design-system';

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
    Feedback.newChat();
    if (noOp) {
      useChatStore.getState().startBlankChat();
      return;
    }
    startPhantomChat(db, 'replace');
  };

  const button = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        glass ? headerGlassButtonFill : styles.button,
        pressed && pressedOpacity,
      ]}
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
    </Pressable>
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
      marginRight: space.four,
    },
  });
