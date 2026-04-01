import React from 'react';
import { View } from 'react-native';

export const BottomSheetModal = React.forwardRef((_props: any, _ref: any) => null);
export const BottomSheetView = ({ children, style }: any) => (
  <View style={style}>{children}</View>
);
export const BottomSheetBackdrop = () => null;
export const BottomSheetModalProvider = ({ children }: any) => <>{children}</>;
