import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { DRAWER_ITEM_INSET } from '../../constants/drawer-layout';
import { dimmedOpacity } from '../../styles/pressable';

const CHAT_LABEL_FONT_SIZE = 15;

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: React.ReactNode;
  testID?: string;
  hugContent?: boolean;
  dimmed?: boolean;
  variant?: 'nav' | 'chat';
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
    dimmed,
    variant = 'nav',
  }: Props) => {
    const { styles } = useThemedStyles(createStyles);

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
        <View style={[styles.content, dimmed && dimmedOpacity]}>
          {icon}
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              variant === 'chat' && styles.chatLabel,
              variant === 'chat' && active && styles.chatLabelActive,
              hugContent && styles.labelHug,
            ]}
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
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: DRAWER_ITEM_INSET,
      borderRadius: 12,
    },
    activeBackground: {
      backgroundColor: theme.bg.softTertiary,
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
    chatLabel: {
      fontSize: CHAT_LABEL_FONT_SIZE,
      lineHeight: lineHeights.sm,
    },
    chatLabelActive: {
      fontFamily: fontFamily.bold,
    },
    labelHug: {
      flex: 0,
    },
  });
