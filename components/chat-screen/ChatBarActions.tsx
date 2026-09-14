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
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';
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

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  isLoadingAttachment?: boolean;
  disabled?: boolean;
  togglesDisabled?: boolean;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
  onSpeechInput: () => void;
  thinkingEnabled: boolean;
  onThinkingToggle?: () => void;
  /** 0 the + is in place → 1 it has cleared the space the panel opens on. */
  plusOut: SharedValue<number>;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: () => void;
}

const ChatBarActions = ({
  onAttach,
  userInput,
  hasAttachments = false,
  isLoadingAttachment = false,
  disabled = false,
  togglesDisabled = false,
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
  // The whole button, not the glyph inside it: the disc is opaque, and fading
  // the glyph alone leaves a blank one wherever the panel does not cover the
  // composer. Only the drawing moves — the backdrop is what takes the tap that
  // dismisses the panel.
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOut.get(), [0, 0.75], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: plusOut.get() * COMPOSER.plusSlide }],
  }));
  const isResponding = isGenerating || isProcessingPrompt;
  const isAttachmentBlocked = isResponding || isLoadingAttachment;

  const whileModelLoads = (action: () => void) => () => {
    if (disabled) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Wait for the model to finish loading.',
      });
      return;
    }
    action();
  };

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
              onPress={whileModelLoads(onSpeechInput)}
              backgroundColor="transparent"
              color={theme.text.onChatBar}
            />
          )}
          <CircleButton
            icon={SendIcon}
            onPress={whileModelLoads(() => {
              Feedback.send();
              onSend();
            })}
            backgroundColor={theme.bg.main}
            color={theme.text.contrastPrimary}
          />
        </View>
      );
    }

    return (
      <CircleButton
        icon={SoundwaveIcon}
        onPress={whileModelLoads(onSpeechInput)}
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
