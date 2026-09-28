import React from 'react';
import { StyleSheet, View } from 'react-native';
import CopyIcon from '../../assets/icons/copy.svg';
import MenuRow from '../menu/MenuRow';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius } from '../../constants/design-system';
import { Theme } from '../../styles/colors';

type UserMessageActionMenuProps = {
  onCopy?: () => void;
};

export default function UserMessageActionMenu({
  onCopy,
}: UserMessageActionMenuProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View
        style={styles.menu}
        pointerEvents="auto"
        onTouchStart={(event) => event.stopPropagation()}
      >
        <MenuRow
          variant="compact"
          label="Copy"
          icon={CopyIcon}
          onPress={onCopy}
        />
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
      borderRadius: radius.twelve,
      overflow: 'hidden',
      backgroundColor: theme.bg.chatBar,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.soft,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
  });
