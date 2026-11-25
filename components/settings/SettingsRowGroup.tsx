import { ROW_PADDING } from '../model-hub/RowGroup';
import React, { Children, Fragment, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, stroke } from '../../constants/design-system';

interface Props {
  children: React.ReactNode;
  separatorInset: number;
  selectedIndex?: number;
}

const SEPARATOR_OPACITY_HIDDEN = 0;

const touchesSelected = (separatorIndex: number, selectedIndex?: number) =>
  selectedIndex !== undefined &&
  (separatorIndex === selectedIndex || separatorIndex === selectedIndex + 1);

const SettingsRowGroup = ({
  children,
  separatorInset,
  selectedIndex,
}: Props) => {
  const { styles } = useThemedStyles(createStyles, separatorInset);
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Fragment key={isValidElement(row) ? row.key : index}>
          {index > 0 && (
            <View
              style={[
                styles.separator,
                touchesSelected(index, selectedIndex) && styles.separatorHidden,
              ]}
            />
          )}
          {row}
        </Fragment>
      ))}
    </View>
  );
};

export default SettingsRowGroup;

const createStyles = (theme: Theme, separatorInset: number) =>
  StyleSheet.create({
    group: {
      borderRadius: radius.twenty,
      borderWidth: stroke.soft,
      borderColor: theme.border.group,
      backgroundColor: theme.bg.group,
      overflow: 'hidden',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: ROW_PADDING + separatorInset,
      backgroundColor: theme.border.groupDivider,
    },
    separatorHidden: {
      opacity: SEPARATOR_OPACITY_HIDDEN,
    },
  });
