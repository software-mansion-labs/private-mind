import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import CopyIcon from '../../assets/icons/copy.svg';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { SvgComponent } from '../../utils/SvgComponent';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

type MenuItemProps = {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
};

const MenuItem = ({ label, icon: Icon, onPress }: MenuItemProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon width={16} height={16} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

type UserMessageActionMenuProps = {
  onCopy?: () => void;
};

export default function UserMessageActionMenu({
  onCopy,
}: UserMessageActionMenuProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View
        style={styles.menu}
        pointerEvents="auto"
        onTouchStart={(event) => event.stopPropagation()}
      >
        <MenuItem label="Copy" icon={CopyIcon} onPress={onCopy} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignSelf: 'flex-end',
    },
    menu: {
      minWidth: 112,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.bg.chatBar,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.soft,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    item: {
      minHeight: 42,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.bg.chatBar,
      opacity: 1,
    },
    itemPressed: {
      opacity: 0.6,
    },
    icon: {
      color: theme.text.onChatBar,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.onChatBar,
    },
  });
