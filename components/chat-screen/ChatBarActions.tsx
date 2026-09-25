import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
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

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  isLoadingAttachment?: boolean;
  togglesDisabled?: boolean;
  modelBusy?: boolean;
  sendPending?: boolean;
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
  const primaryAction: PrimaryAction = isResponding
    ? 'stop'
    : hasComposedInput
      ? 'send'
      : 'voice';
  const guardPrimaryPress = usePrimaryActionGuard(primaryAction);

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

  const renderButton = () => {
    const action: ComposerAction =
      primaryAction === 'stop'
        ? 'stop'
        : sendPending || primaryAction === 'send'
          ? 'send'
          : 'speech';

    const handlePress = () => {
      if (action === 'stop') {
        guardPrimaryPress(() => {
          Feedback.interrupt();
          onInterrupt();
        });
        return;
      }
      if (action === 'send') {
        guardPrimaryPress(() => {
          Feedback.send();
          onSend();
        });
        return;
      }
      guardPrimaryPress(onSpeechInput);
    };

    const testID =
      action === 'send'
        ? 'send-btn'
        : action === 'stop'
          ? 'stop-btn'
          : 'speech-btn';

    return (
      <View style={styles.rightActions}>
        {action === 'send' && hasAttachments && !userInput && !sendPending && (
          <CircleButton
            icon={SoundwaveIcon}
            testID="speech-btn"
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
          testID={testID}
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
          onToggle={() => onThinkingToggle?.()}
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

const createStyles = (_theme: Theme) =>
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
