import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: React.ReactNode;
  testID?: string;
  hugContent?: boolean;
}

export const DrawerItem = memo(
  ({
    label,
    active,
    onPress,
    onLongPress,
    icon,
    testID,
    hugContent,
  }: Props) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        testID={testID}
        style={({ pressed }) => [
          styles.item,
          (active || pressed) && styles.activeBackground,
        ]}
      >
        <View style={styles.content}>
          {icon}
          <Text
            numberOfLines={1}
            style={[styles.label, hugContent && styles.labelHug]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }
);

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
      flex: 1,
    },
    labelHug: {
      flex: 0,
    },
  });
