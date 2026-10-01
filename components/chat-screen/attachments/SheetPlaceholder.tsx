import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily } from '../../../styles/fontStyles';
import { panelPalette, PRESS_ANYWHERE } from './constants';

interface Props {
  children: ReactNode;
  onOpenSettings?: () => void;
}

const SheetPlaceholder = ({ children, onOpenSettings }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{children}</Text>
      {onOpenSettings && (
        <TouchableOpacity
          onPress={onOpenSettings}
          style={styles.action}
          pressRetentionOffset={PRESS_ANYWHERE}
          testID="sheet-open-settings"
        >
          <Text style={styles.actionLabel}>Open Settings</Text>
        </TouchableOpacity>
      )}
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
    action: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 999,
      backgroundColor: panelPalette(theme).accent,
    },
    actionLabel: {
      color: theme.text.contrastPrimary,
      fontSize: 15,
      fontFamily: fontFamily.medium,
    },
  });
