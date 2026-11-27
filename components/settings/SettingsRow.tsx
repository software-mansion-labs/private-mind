import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { rowChevron, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { pressedOpacity } from '../../styles/pressable';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';

export const SETTINGS_ROW_HEIGHT = 48;

interface Props {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
  value?: string;
  valueTestID?: string;
  showChevron?: boolean;
  accessory?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link';
  testID?: string;
}

export const SettingsRow = ({
  label,
  icon,
  onPress,
  destructive,
  value,
  valueTestID,
  showChevron = false,
  accessory,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && pressedOpacity]}
    >
      {icon}
      <Text
        style={[styles.label, destructive && styles.destructive]}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={styles.value}
          testID={valueTestID}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {value}
        </Text>
      ) : null}
      {showChevron ? (
        <View style={styles.chevronSlot}>
          <ChevronRightIcon
            width={rowChevron.width}
            height={rowChevron.height}
            style={styles.chevron}
          />
        </View>
      ) : null}
      {accessory}
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: SETTINGS_ROW_HEIGHT,
      paddingVertical: space.two,
      paddingHorizontal: space.four,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    label: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    destructive: {
      color: theme.text.error,
    },
    value: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.defaultTertiary,
    },
    chevronSlot: {
      marginLeft: -space.one,
    },
    chevron: {
      color: theme.text.defaultTertiary,
    },
  });
