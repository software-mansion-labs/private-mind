import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView, Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { radius, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  PROMPT_SUGGESTION_ROWS,
  type PromptSuggestion,
} from '../../constants/default-prompts';
import { pressedOpacity } from '../../styles/pressable';
import { GUTTER } from './attachments/constants';

const PILL_HEIGHT = 44;
const ICON_TILE_SIZE = 24;
const ICON_SIZE = 14;

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

const PromptSuggestions = ({ onSelectPrompt }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {PROMPT_SUGGESTION_ROWS.map((row) => (
        <ScrollView
          key={row[0]!.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.row}
          contentContainerStyle={styles.rowContent}
        >
          {row.map((suggestion) => (
            <SuggestionPill
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSelectPrompt(suggestion.prompt)}
            />
          ))}
        </ScrollView>
      ))}
    </View>
  );
};

interface PillProps {
  suggestion: PromptSuggestion;
  onPress: () => void;
}

const SuggestionPill = ({ suggestion, onPress }: PillProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { icon: Icon, tone } = suggestion;
  const toneColors = theme.label[tone];

  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && pressedOpacity]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.title}: ${suggestion.prompt}`}
      testID="prompt-suggestion-pill"
    >
      <View
        style={[styles.iconTile, { backgroundColor: toneColors.background }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={{ color: toneColors.foreground }}
        />
      </View>
      <Text
        style={styles.title}
        numberOfLines={1}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {suggestion.title}
      </Text>
    </Pressable>
  );
};

export default PromptSuggestions;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: space.two,
    },
    row: {
      flexGrow: 0,
      marginHorizontal: -GUTTER,
    },
    rowContent: {
      gap: space.two,
      paddingHorizontal: GUTTER,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: PILL_HEIGHT,
      gap: space.two,
      paddingLeft: space.twoHalf,
      paddingRight: space.four,
      borderRadius: radius.full,
      backgroundColor: theme.bg.chatBar,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
