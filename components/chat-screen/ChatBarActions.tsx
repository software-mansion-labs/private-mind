import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';

interface Props {
  onSelectSource: () => void;
  activeSourcesCount: number;
  userInput: string;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
  onSpeechInput: () => void;
}

const ChatBarActions = ({
  onSelectSource,
  activeSourcesCount,
  userInput,
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
  onSpeechInput,
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

    if (userInput) {
      return (
        <CircleButton
          icon={SendIcon}
          onPress={onSend}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      );
    }

    return (
      <CircleButton
        icon={SoundwaveIcon}
        onPress={onSpeechInput}
        backgroundColor="transparent"
        color={theme.text.contrastPrimary}
      />
    );

    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        <TouchableOpacity onPress={onSelectSource} style={styles.sourceButton}>
          {activeSourcesCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{activeSourcesCount}</Text>
            </View>
          )}
          <Text style={styles.sourceText}>Sources</Text>
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
    sourceButton: {
      padding: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.border.contrast,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    countBadge: {
      borderRadius: 9999,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
    },
    countText: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.contrastPrimary,
    },
    sourceText: {
      color: theme.text.contrastPrimary,
      lineHeight: lineHeights.sm,
    },
  });
