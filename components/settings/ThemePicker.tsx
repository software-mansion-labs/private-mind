import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { Feedback } from '../../utils/Feedback';
import type { ThemePreference } from '../../store/settingsStore';
import { THEME_PREVIEW_ASPECT_RATIO, ThemePreview } from './ThemePreview';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const RING_GAP = 3;
const PREVIEW_RADIUS = radius.twelve;

interface Props {
  value: ThemePreference;
  onValueChange: (value: ThemePreference) => void;
}

export const ThemePicker = ({ value, onValueChange }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const handleSelect = (next: ThemePreference) => {
    if (next === value) return;
    Feedback.toggleOn();
    onValueChange(next);
  };

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel="Theme"
    >
      {THEME_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            testID={`settings-theme-${option.value}`}
            style={({ pressed }) => [styles.option, pressed && pressedOpacity]}
          >
            <View style={[styles.ring, selected && styles.ringSelected]}>
              <View style={styles.preview}>
                <ThemePreview variant={option.value} />
              </View>
            </View>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: space.three,
      padding: space.four,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      gap: space.two,
    },
    ring: {
      alignSelf: 'stretch',
      padding: RING_GAP,
      borderRadius: PREVIEW_RADIUS + RING_GAP + stroke.strong,
      borderWidth: stroke.strong,
      borderColor: 'transparent',
    },
    ringSelected: {
      borderColor: theme.text.accent,
    },
    preview: {
      aspectRatio: THEME_PREVIEW_ASPECT_RATIO,
      borderRadius: PREVIEW_RADIUS,
      borderWidth: stroke.soft,
      borderColor: theme.border.group,
      overflow: 'hidden',
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    labelSelected: {
      color: theme.text.accent,
    },
  });
