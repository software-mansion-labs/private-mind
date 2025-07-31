import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import Toast, { ToastConfig } from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import CloseIcon from '../assets/icons/close.svg';
import { fontFamily, fontSizes } from '../styles/fontStyles';

const AppToast: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const toastConfig: ToastConfig = {
    defaultToast: ({ text1 }) => (
      <View style={styles.toastContainer}>
        <Text style={styles.toastText}>{text1}</Text>
        <TouchableOpacity
          onPress={() => Toast.hide()}
          style={styles.toastCloseButton}
        >
          <CloseIcon width={13.33} height={13.33} style={styles.toastIcon} />
        </TouchableOpacity>
      </View>
    ),
  };

  const renderToast = () => {
    return <Toast config={toastConfig} topOffset={insets.top + 16} />;
  };

  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{renderToast()}</FullWindowOverlay>;
  } else {
    return renderToast();
  }
};

export default AppToast;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    toastContainer: {
      width: '90%',
      backgroundColor: theme.bg.softSecondary,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
    },
    toastText: {
      color: theme.text.primary,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      width: '80%',
    },
    toastCloseButton: {
      width: '20%',
      alignItems: 'flex-end',
      marginTop: 3.33,
    },
    toastIcon: {
      color: theme.text.primary,
    },
  });
