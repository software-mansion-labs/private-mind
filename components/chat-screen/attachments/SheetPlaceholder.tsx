import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily } from '../../../styles/fontStyles';
import { panelPalette } from './constants';

/**
 * What a sheet shows when it has no content: the grid while the library loads
 * or stays denied, the camera while it waits for permission.
 */
const SheetPlaceholder = ({ children }: { children: ReactNode }) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{children}</Text>
    </View>
  );
};

export default SheetPlaceholder;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 48,
    },
    placeholderText: {
      color: panelPalette(theme).placeholder,
      fontSize: 15,
      fontFamily: fontFamily.regular,
      textAlign: 'center',
    },
  });
