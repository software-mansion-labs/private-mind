import React from 'react';
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
import { useThemedStyles } from '../hooks/useThemedStyles';
import CloseIcon from '../assets/icons/close.svg';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { openAppSettings } from '../utils/openAppSettings';

const AppToast: React.FC = () => {
  const { styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const toastConfig: ToastConfig = {
    defaultToast: ({ text1, props }) => (
      <View style={styles.toastContainer}>
        <View style={styles.toastBody}>
          <Text style={styles.toastText}>{text1}</Text>
          {props?.settings && (
            <TouchableOpacity
              onPress={() => {
                Toast.hide();
                openAppSettings();
              }}
              style={styles.toastAction}
              testID="toast-open-settings"
            >
              <Text style={styles.toastActionLabel}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
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
    toastBody: {
      width: '80%',
    },
    toastText: {
      color: theme.text.primary,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
    },
    toastAction: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: theme.bg.main,
    },
    toastActionLabel: {
      color: theme.text.contrastPrimary,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
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
