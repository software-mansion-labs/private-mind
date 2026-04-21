import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import LightBulbCrossedIcon from '../../assets/icons/light_bulb_crossed.svg';
import LightBulbIcon from '../../assets/icons/light_bulb.svg';
import PlusIcon from '../../assets/icons/plus.svg';

interface Props {
  onAttach: () => void;
  userInput: string;
  hasAttachments?: boolean;
  isLoadingAttachment?: boolean;
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
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
  onSpeechInput,
  thinkingEnabled = false,
  onThinkingToggle,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderButton = () => {
    if (isGenerating || isProcessingPrompt) {
      return (
        <CircleButton
          icon={PauseIcon}
          size={13.33}
          onPress={onInterrupt}
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
              onPress={onSpeechInput}
              backgroundColor="transparent"
              color={theme.text.onChatBar}
            />
          )}
          <CircleButton
            icon={SendIcon}
            onPress={onSend}
            backgroundColor={theme.bg.main}
            color={theme.text.contrastPrimary}
          />
        </View>
      );
    }

    return (
      <CircleButton
        icon={SoundwaveIcon}
        onPress={onSpeechInput}
        backgroundColor="transparent"
        color={theme.text.onChatBar}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        <CircleButton
          icon={PlusIcon}
          size={14}
          onPress={onAttach}
          backgroundColor={theme.bg.attachButton}
          color={theme.text.onAttachButton}
          testID="attach-btn"
        />
        <TouchableOpacity
          onPress={onThinkingToggle}
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
