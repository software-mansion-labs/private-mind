import React, { Children, Fragment, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, space } from '../../constants/design-system';

export const ROW_PADDING = space.three;
export const ROW_TILE_SIZE = space.ten;
export const TILE_ROW_TEXT_INSET = ROW_PADDING * 2 + ROW_TILE_SIZE;

interface Props {
  children: React.ReactNode;
  separatorInset: number;
}

const RowGroup = ({ children, separatorInset }: Props) => {
  const { styles } = useThemedStyles(createStyles, separatorInset);
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Fragment key={isValidElement(row) ? row.key : index}>
          {index > 0 && <View style={styles.separator} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
};

export default RowGroup;

const createStyles = (theme: Theme, separatorInset: number) =>
  StyleSheet.create({
    group: {
      borderRadius: radius.twelve,
      borderWidth: 1,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
      overflow: 'hidden',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: separatorInset,
      backgroundColor: theme.border.soft,
    },
  });
