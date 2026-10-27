import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import Toast, { ToastConfig } from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '../styles/colors';
import { radius, space, stroke } from '../constants/design-system';
import { useThemedStyles } from '../hooks/useThemedStyles';
import CloseIcon from '../assets/icons/close.svg';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { openAppSettings } from '../utils/openAppSettings';
import { pressedOpacity } from '../styles/pressable';

const NAV_HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
const TOAST_HEADER_GAP = 2;
const CLOSE_HIT_SLOP = 12;

export const toastTopOffset = (safeAreaTop: number) =>
  safeAreaTop + NAV_HEADER_HEIGHT + TOAST_HEADER_GAP;

interface ToastActionProps {
  label: string;
  testID: string;
  onPress: () => void;
}

const ToastAction = ({ label, testID, onPress }: ToastActionProps) => {
  const { styles } = useThemedStyles(createStyles);

  const handlePress = () => {
    Toast.hide();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      cancelable={false}
      accessibilityRole="button"
      style={({ pressed }) => [styles.toastAction, pressed && pressedOpacity]}
      testID={testID}
    >
      <Text style={styles.toastActionLabel}>{label}</Text>
    </Pressable>
  );
};

const AppToast: React.FC = () => {
  const { styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const toastConfig: ToastConfig = {
    defaultToast: ({ text1, props }) => (
      <View style={styles.toastContainer}>
        <View style={styles.toastBody}>
          <Text style={styles.toastText}>{text1}</Text>
          {props?.settings && (
            <ToastAction
              label="Open Settings"
              testID="toast-open-settings"
              onPress={openAppSettings}
            />
          )}
          {props?.onRetry && (
            <ToastAction
              label="Retry"
              testID="toast-retry"
              onPress={props.onRetry}
            />
          )}
        </View>
        <Pressable
          onPress={() => Toast.hide()}
          cancelable={false}
          hitSlop={CLOSE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => [
            styles.toastCloseButton,
            pressed && pressedOpacity,
          ]}
          testID="toast-close"
        >
          <CloseIcon width={13.33} height={13.33} style={styles.toastIcon} />
        </Pressable>
      </View>
    ),
  };

  const renderToast = () => {
    return (
      <Toast config={toastConfig} topOffset={toastTopOffset(insets.top)} />
    );
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
      backgroundColor: theme.bg.toast,
      borderRadius: radius.eighteen,
      padding: space.four,
      flexDirection: 'row',
      borderWidth: stroke.soft,
      borderColor: theme.border.toast,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.shadow.floatingOpacity,
      shadowRadius: 20,
      elevation: 12,
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
      marginTop: space.three,
      alignSelf: 'flex-start',
      paddingVertical: space.two,
      paddingHorizontal: space.four,
      borderRadius: radius.full,
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
