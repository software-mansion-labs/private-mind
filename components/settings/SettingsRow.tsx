import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';
import { pressedOpacity } from '../../styles/pressable';

interface Props {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
}

export const SettingsRow = ({ label, icon, onPress, destructive }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && pressedOpacity]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[styles.label, destructive && styles.destructive]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
  });
