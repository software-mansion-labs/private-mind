import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import LightBulbCrossedIcon from '../../assets/icons/light_bulb_crossed.svg';
import LightBulbIcon from '../../assets/icons/light_bulb.svg';
import PlusIcon from '../../assets/icons/plus.svg';
import { Feedback } from '../../utils/Feedback';
import Toast from 'react-native-toast-message';

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  isLoadingAttachment?: boolean;
  disabled?: boolean;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
  onSpeechInput: () => void;
  thinkingEnabled: boolean;
  onThinkingToggle?: () => void;
}

const ChatBarActions = ({
  onAttach,
  userInput,
  hasAttachments = false,
  isLoadingAttachment = false,
  disabled = false,
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
  onSpeechInput,
  thinkingEnabled = false,
  onThinkingToggle,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const isResponding = isGenerating || isProcessingPrompt;
  const isAttachmentBlocked = isResponding || isLoadingAttachment || disabled;
  const attachmentOpacity = useSharedValue(isAttachmentBlocked ? 0.4 : 1);
  const primaryActionOpacity = useSharedValue(disabled ? 0.4 : 1);

  useEffect(() => {
    attachmentOpacity.set(
      withTiming(isAttachmentBlocked ? 0.4 : 1, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [attachmentOpacity, isAttachmentBlocked]);

  useEffect(() => {
    primaryActionOpacity.set(
      withTiming(disabled ? 0.4 : 1, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [disabled, primaryActionOpacity]);

  const attachmentDisabledStyle = useAnimatedStyle(() => ({
    opacity: attachmentOpacity.get(),
  }));
  const primaryActionDisabledStyle = useAnimatedStyle(() => ({
    opacity: primaryActionOpacity.get(),
  }));

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
    if (isGenerating || isProcessingPrompt) {
      return (
        <CircleButton
          icon={PauseIcon}
          size={13.33}
          onPress={() => {
            Feedback.interrupt();
            onInterrupt();
          }}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      );
    }

    if ((userInput || hasAttachments) && !isLoadingAttachment) {
      return (
        <View style={styles.rightActions}>
          {hasAttachments && !userInput && (
            <CircleButton
              icon={SoundwaveIcon}
              disabled={disabled}
              onPress={onSpeechInput}
              backgroundColor="transparent"
              color={theme.text.onChatBar}
            />
          )}
          <CircleButton
            icon={SendIcon}
            disabled={disabled}
            onPress={() => {
              Feedback.send();
              onSend();
            }}
            backgroundColor={theme.bg.main}
            color={theme.text.contrastPrimary}
          />
        </View>
      );
    }

    return (
      <CircleButton
        icon={SoundwaveIcon}
        disabled={disabled}
        onPress={onSpeechInput}
        backgroundColor="transparent"
        color={theme.text.onChatBar}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        <Animated.View
          testID="attach-btn-container"
          style={attachmentDisabledStyle}
        >
          <CircleButton
            icon={PlusIcon}
            size={14}
            onPress={handleAttach}
            backgroundColor={theme.bg.attachButton}
            color={theme.text.onAttachButton}
            testID="attach-btn"
          />
        </Animated.View>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => {
            if (thinkingEnabled) {
              Feedback.toggleOff();
            } else {
              Feedback.toggleOn();
            }
            onThinkingToggle?.();
          }}
          style={[
            styles.toggleButton,
            (!thinkingEnabled || disabled) && { opacity: 0.4 },
          ]}
        >
          {!thinkingEnabled ? (
            <LightBulbCrossedIcon
              style={{ color: theme.text.onChatBar }}
              width={20}
              height={20}
            />
          ) : (
            <LightBulbIcon
              style={{ color: theme.text.onChatBar }}
              width={20}
              height={20}
            />
          )}
          <Text style={styles.toggleText}>Think</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={primaryActionDisabledStyle}>
        {renderButton()}
      </Animated.View>
    </View>
  );
};

export default ChatBarActions;

const createStyles = (theme: Theme) =>
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
    rightActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    toggleButton: {
      padding: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.text.onChatBar,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      height: 36,
    },
    toggleText: {
      color: theme.text.onChatBar,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
    },
  });
