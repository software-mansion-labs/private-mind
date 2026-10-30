import React, { Children, Fragment, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, space, stroke } from '../../constants/design-system';

export const ROW_PADDING = space.three;

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
      borderRadius: radius.eighteen,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
      overflow: 'hidden',
    },
    separator: {
      height: stroke.soft,
      marginLeft: separatorInset,
      backgroundColor: theme.border.soft,
    },
  });
