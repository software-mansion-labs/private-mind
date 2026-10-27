import React, { memo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { DRAWER_ITEM_INSET } from '../../constants/drawer-layout';
import { dimmedOpacity } from '../../styles/pressable';
import { radius, space } from '../../constants/design-system';

const CHAT_LABEL_FONT_SIZE = 15;

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: (rect: WindowRect) => void;
  highlighted?: boolean;
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
    highlighted,
    icon,
    testID,
    hugContent,
    dimmed,
    variant = 'nav',
  }: Props) => {
    const { styles } = useThemedStyles(createStyles);
    const rowRef = useRef<View>(null);

    const handleLongPress = onLongPress
      ? () =>
          rowRef.current?.measureInWindow((x, y, width, height) =>
            onLongPress({ x, y, width, height })
          )
      : undefined;

    return (
      <View ref={rowRef} collapsable={false}>
        <Pressable
          onPress={onPress}
          onLongPress={handleLongPress}
          testID={testID}
          style={({ pressed }) => [
            styles.item,
            (active || highlighted || pressed) && styles.activeBackground,
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
      </View>
    );
  }
);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    item: {
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: space.two,
      paddingHorizontal: DRAWER_ITEM_INSET,
      borderRadius: radius.twelve,
    },
    activeBackground: {
      backgroundColor: theme.bg.softTertiary,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
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
