import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Feedback } from '../../utils/Feedback';
import { opacity, radius } from '../../constants/design-system';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
}

export const SettingsChoiceRow = <T extends string>({
  label,
  options,
  value,
  onValueChange,
}: Props<T>) => {
  const { styles } = useThemedStyles(createStyles);

  const handleSelect = (next: T) => {
    if (next === value) return;
    Feedback.toggleOn();
    onValueChange(next);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`settings-choice-${option.value}`}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.optionText, selected && styles.selectedText]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softSecondary,
      gap: 12,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    options: {
      flexDirection: 'row',
      gap: 8,
    },
    option: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.full,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    optionSelected: {
      backgroundColor: theme.bg.main,
      borderColor: theme.bg.main,
    },
    pressed: {
      opacity: opacity.pressed,
    },
    optionText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    selectedText: {
      color: theme.text.contrastPrimary,
    },
  });
