import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import CircleButton from '../CircleButton';
import ComposerActionButton, {
  type ComposerAction,
} from './ComposerActionButton';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import LightBulbCrossedIcon from '../../assets/icons/light_bulb_crossed.svg';
import LightBulbIcon from '../../assets/icons/light_bulb.svg';
import PlusIcon from '../../assets/icons/plus.svg';
import WebIcon from '../../assets/icons/web.svg';
import WebCrossedIcon from '../../assets/icons/web_crossed.svg';
import ChatBarToggle from './ChatBarToggle';
import { Feedback } from '../../utils/Feedback';
import Toast from 'react-native-toast-message';
import { COMPOSER } from './attachments/constants';
import {
  usePrimaryActionGuard,
  type PrimaryAction,
} from './usePrimaryActionGuard';

const composerAction = (
  isResponding: boolean,
  canSend: boolean
): ComposerAction => {
  if (isResponding) return 'stop';
  if (canSend) return 'send';
  return 'speech';
};

const ACTION_TEST_IDS: Record<ComposerAction, string> = {
  send: 'send-btn',
  stop: 'stop-btn',
  speech: 'speech-btn',
};

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  isLoadingAttachment?: boolean;
  togglesDisabled?: boolean;
  modelBusy?: boolean;
  sendPending?: boolean;
  sendInFlight?: boolean;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
  onSpeechInput: () => void;
  thinkingEnabled: boolean;
  onThinkingToggle?: () => void;
  plusOut: SharedValue<number>;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: () => void;
}

const ChatBarActions = ({
  onAttach,
  userInput,
  hasAttachments = false,
  isLoadingAttachment = false,
  togglesDisabled = false,
  modelBusy = false,
  sendPending = false,
  sendInFlight = false,
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
  onSpeechInput,
  thinkingEnabled = false,
  onThinkingToggle,
  plusOut,
  webSearchEnabled = false,
  onWebSearchToggle,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOut.get(), [0, 0.75], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: plusOut.get() * COMPOSER.plusSlide }],
  }));
  const isResponding = isGenerating || isProcessingPrompt;
  const isAttachmentBlocked = isResponding || isLoadingAttachment;
  const hasComposedInput = !!userInput || hasAttachments;
  const isSendable = hasComposedInput;
  const action = composerAction(
    isResponding,
    Boolean(sendPending || sendInFlight || isSendable)
  );
  const guardedAction: PrimaryAction = action === 'speech' ? 'voice' : action;
  const guardPrimaryPress = usePrimaryActionGuard(guardedAction);

  const handleAttach = () => {
    if (isAttachmentBlocked) {
      Toast.show({
        type: 'defaultToast',
        text1: isResponding
          ? 'Wait for the response to finish or stop it first.'
          : 'Wait for the document to finish processing.',
      });
      return;
    }

    Feedback.attach();
    onAttach();
  };

  const handleThinkingToggle = () => onThinkingToggle?.();

  const renderButton = () => {
    const handlePress = () =>
      guardPrimaryPress(() => {
        if (action === 'stop') {
          Feedback.interrupt();
          onInterrupt();
          return;
        }
        if (action === 'send') {
          Feedback.send();
          onSend();
          return;
        }
        onSpeechInput();
      });

    return (
      <View style={styles.rightActions}>
        {action === 'send' && hasAttachments && !userInput && !sendPending && (
          <CircleButton
            icon={SoundwaveIcon}
            accessibilityLabel="Dictate message"
            onPress={onSpeechInput}
            backgroundColor="transparent"
            color={theme.text.onChatBar}
          />
        )}
        <ComposerActionButton
          action={action}
          onPress={handlePress}
          busy={action === 'send' && sendPending}
          disabled={action === 'send' && (sendPending || isLoadingAttachment)}
          dimmed={action === 'speech' && modelBusy}
          testID={ACTION_TEST_IDS[action]}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        <View
          testID="attach-btn-container"
          style={isAttachmentBlocked ? styles.blockedAttachment : undefined}
        >
          <Animated.View style={plusStyle}>
            <CircleButton
              icon={PlusIcon}
              accessibilityLabel="Attach file"
              size={14}
              onPress={handleAttach}
              backgroundColor={theme.bg.attachButton}
              color={theme.text.onAttachButton}
              testID="attach-btn"
            />
          </Animated.View>
        </View>
        <ChatBarToggle
          label="Think"
          enabled={thinkingEnabled}
          iconOn={LightBulbIcon}
          iconOff={LightBulbCrossedIcon}
          onToggle={handleThinkingToggle}
          disabled={togglesDisabled}
        />
        {onWebSearchToggle ? (
          <ChatBarToggle
            label="Web"
            enabled={webSearchEnabled}
            iconOn={WebIcon}
            iconOff={WebCrossedIcon}
            onToggle={onWebSearchToggle}
            disabled={togglesDisabled}
            testID="web-search-toggle"
          />
        ) : null}
      </View>

      {renderButton()}
    </View>
  );
};

export default ChatBarActions;

const createStyles = () =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
    },
    leftActions: {
      flexDirection: 'row',
      gap: 8,
    },
    blockedAttachment: {
      opacity: 0.4,
    },
    rightActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
  });
