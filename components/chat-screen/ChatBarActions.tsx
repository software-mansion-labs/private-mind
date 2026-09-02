import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
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
import { COMPOSER } from './attachments/constants';

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
  /** 0 the + is in place → 1 it has cleared the space the panel opens on. */
  plusOut: SharedValue<number>;
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
  plusOut,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  // Only the glyph moves: the hit target stays where it is, so the tap that
  // dismisses the panel lands on the same spot the one that opened it did.
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOut.get(), [0, 0.75], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: plusOut.get() * COMPOSER.plusSlide }],
  }));
  const isResponding = isGenerating || isProcessingPrompt;
  const isAttachmentBlocked = isResponding || isLoadingAttachment;

  const handleAttach = () => {
    if (disabled) {
      return;
    }

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
        <View
          testID="attach-btn-container"
          style={isAttachmentBlocked ? styles.blockedAttachment : undefined}
        >
          <CircleButton
            icon={PlusIcon}
            size={14}
            onPress={handleAttach}
            backgroundColor={theme.bg.attachButton}
            color={theme.text.onAttachButton}
            iconStyle={plusStyle}
            testID="attach-btn"
          />
        </View>
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
          style={[styles.toggleButton, !thinkingEnabled && { opacity: 0.4 }]}
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

      {renderButton()}
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
    blockedAttachment: {
      opacity: 0.4,
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
