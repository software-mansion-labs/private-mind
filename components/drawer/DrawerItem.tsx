import React, { memo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';

export const DrawerItem = memo(
  ({
    label,
    active,
    onPress,
    icon,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    icon?: React.ReactNode;
  }) => {
    const { theme } = useTheme();
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          active && {
            backgroundColor: theme.bg.softSecondary,
          },
          pressed && {
            backgroundColor: theme.bg.softSecondary,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {icon && icon}
          <Text style={[{ ...styles.label, color: theme.text.primary }]}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  item: {
    padding: 12,
    borderRadius: 12,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
});
