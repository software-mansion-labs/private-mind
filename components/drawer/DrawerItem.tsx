import React, { memo, useMemo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { Theme } from '../../styles/colors';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}

export const DrawerItem = memo(({ label, active, onPress, icon }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        (active || pressed) && styles.activeBackground,
      ]}
    >
      <View style={styles.content}>
        {icon && icon}
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    item: {
      padding: 12,
      borderRadius: 12,
    },
    activeBackground: {
      backgroundColor: theme.bg.softSecondary,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
