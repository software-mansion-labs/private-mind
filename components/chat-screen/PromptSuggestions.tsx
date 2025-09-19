import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import {
  DEFAULT_PROMPT_SUGGESTIONS,
  PROMPT_SUGGESTIONS_TEXT,
} from '../../constants/default-prompts';

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

const PromptSuggestions = ({ onSelectPrompt }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handlePromptPress = (prompt: string) => {
    onSelectPrompt(prompt);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{PROMPT_SUGGESTIONS_TEXT.title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DEFAULT_PROMPT_SUGGESTIONS.map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={styles.suggestionCard}
            onPress={() => handlePromptPress(suggestion.prompt)}
            activeOpacity={0.7}
          >
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionPrompt} numberOfLines={3}>
              {suggestion.prompt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default PromptSuggestions;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 8,
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      marginBottom: 12,
    },
    scrollContent: {
      gap: 8,
    },
    suggestionCard: {
      width: 160,
      backgroundColor: theme.bg.softSecondary,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.bg.softSecondary,
    },
    suggestionTitle: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      marginBottom: 6,
    },
    suggestionPrompt: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
  });
