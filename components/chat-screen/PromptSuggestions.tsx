import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView, Pressable } from 'react-native-gesture-handler';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { radius, space } from '../../constants/design-system';
import {
  DEFAULT_PROMPT_SUGGESTIONS,
  PROMPT_SUGGESTIONS_TEXT,
  SUGGESTION_CARD_WIDTH,
  type PromptSuggestion,
} from '../../constants/default-prompts';
import { pressedOpacity } from '../../styles/pressable';
import { GUTTER } from './attachments/constants';

const ICON_TILE_SIZE = 24;
const ICON_TILE_RADIUS = 7;
const ICON_SIZE = 14;
const CARD_TITLE_LINE_HEIGHT = 18;
const PROMPT_SIZE = 13;
const PROMPT_LINE_HEIGHT = 18;
const EDGE_FADE_WIDTH = GUTTER;
const MASK_OPAQUE = '#000000';
const MASK_CLEAR = 'rgba(0, 0, 0, 0)';

interface Props {
  onSelectPrompt: (prompt: string) => void;
}

const PromptSuggestions = ({ onSelectPrompt }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole="header">
        {PROMPT_SUGGESTIONS_TEXT.title}
      </Text>
      <MaskedView
        style={styles.bleed}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient
              colors={[MASK_CLEAR, MASK_OPAQUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.maskEdge}
            />
            <View style={styles.maskBody} />
            <LinearGradient
              colors={[MASK_OPAQUE, MASK_CLEAR]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.maskEdge}
            />
          </View>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {DEFAULT_PROMPT_SUGGESTIONS.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSelectPrompt(suggestion.prompt)}
            />
          ))}
        </ScrollView>
      </MaskedView>
    </View>
  );
};

interface CardProps {
  suggestion: PromptSuggestion;
  onPress: () => void;
}

const SuggestionCard = ({ suggestion, onPress }: CardProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { icon: Icon, tone } = suggestion;
  const toneColors = theme.label[tone];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && pressedOpacity]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${suggestion.title}: ${suggestion.prompt}`}
      testID="prompt-suggestion-card"
    >
      <View style={styles.titleRow}>
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
          style={styles.cardTitle}
          numberOfLines={1}
          testID="suggestion-title"
        >
          {suggestion.title}
        </Text>
      </View>
      <Text style={styles.prompt} numberOfLines={1}>
        {suggestion.prompt}
      </Text>
    </Pressable>
  );
};

export default PromptSuggestions;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: space.four,
    },
    heading: {
      fontSize: fontSizes.xl,
      lineHeight: lineHeights.xl,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      textAlign: 'center',
    },
    bleed: {
      marginHorizontal: -GUTTER,
    },
    mask: {
      flex: 1,
      flexDirection: 'row',
    },
    maskEdge: {
      width: EDGE_FADE_WIDTH,
    },
    maskBody: {
      flex: 1,
      backgroundColor: MASK_OPAQUE,
    },
    scrollContent: {
      gap: space.two,
      paddingHorizontal: GUTTER,
      alignItems: 'stretch',
    },
    card: {
      width: SUGGESTION_CARD_WIDTH,
      gap: space.one + space.half,
      paddingVertical: space.three,
      paddingHorizontal: space.three + space.half,
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.whatsNewCard,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: ICON_TILE_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      flex: 1,
      fontSize: fontSizes.sm,
      lineHeight: CARD_TITLE_LINE_HEIGHT,
      fontFamily: fontFamily.bold,
      color: theme.text.primary,
    },
    prompt: {
      fontSize: PROMPT_SIZE,
      lineHeight: PROMPT_LINE_HEIGHT,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
