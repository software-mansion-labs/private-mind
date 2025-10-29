import React from 'react';
import { Platform } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props
  extends Omit<
    KeyboardAvoidingViewProps,
    'behaviour' | 'contentContainerStyle'
  > {
  isModalScreen?: boolean;
}

const headerBarHeight = Platform.select({
  ios: 40,
  android: 56,
  default: 0,
});

export const CustomKeyboardAvoidingView: React.FC<Props> = ({
  isModalScreen,
  ...props
}: Props) => {
  const insets = useSafeAreaInsets();

  const topOffset = isModalScreen
    ? // modal screens wrap the entire screen in KAV and render the header inside
      // so we only need to account for modal screen position on iOS
      Platform.select({ ios: insets.top + 10, default: 0 })
    : insets.top + headerBarHeight;

  return (
    <KeyboardAvoidingView
      behaviour="padding"
      // subtracting bottom inset makes the keyboard cover the safe are padding
      // present on the screen
      keyboardVerticalOffset={topOffset - insets.bottom}
      {...props}
    />
  );
};
