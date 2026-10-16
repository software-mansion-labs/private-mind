import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { space } from '../../constants/design-system';
import { Theme } from '../../styles/colors';

const ROW_MIN_HEIGHT = 44;

type Props = Omit<PressableProps, 'style'>;

const PopoverRow = (props: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    />
  );
};

export default PopoverRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      paddingVertical: space.one + space.half,
      paddingHorizontal: space.four,
    },
    pressed: {
      backgroundColor: theme.bg.dialogAction,
    },
  });
