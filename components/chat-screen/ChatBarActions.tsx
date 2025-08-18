import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import CircleButton from '../CircleButton';

interface Props {
  onSelectSource: () => void;
  activeSourcesCount: number;
  userInput: string;
  onSend: () => void;
  isGenerating: boolean;
  isProcessingPrompt: boolean;
  onInterrupt: () => void;
}

const ChatBarActions = ({
  onSelectSource,
  activeSourcesCount,
  userInput,
  onSend,
  isGenerating,
  isProcessingPrompt,
  onInterrupt,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showSendButton = userInput && !isGenerating && !isProcessingPrompt;
  const showPauseButton = isGenerating || isProcessingPrompt;

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

      {showSendButton && (
        <CircleButton
          icon={SendIcon}
          onPress={onSend}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      )}

      {showPauseButton && (
        <CircleButton
          icon={PauseIcon}
          size={13.33}
          onPress={onInterrupt}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      )}
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
    sendButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 18,
      backgroundColor: theme.bg.main,
    },
    iconContrast: {
      color: theme.text.contrastPrimary,
    },
  });
