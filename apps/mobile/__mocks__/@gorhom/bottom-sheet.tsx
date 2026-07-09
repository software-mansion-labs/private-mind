import React from 'react';
import { View, FlatList } from 'react-native';

export const BottomSheetModal = React.forwardRef(
  ({ children }: any, _ref: any) => <>{children}</>
);
export const BottomSheetView = ({ children, style }: any) => (
  <View style={style}>{children}</View>
);
export const BottomSheetFlatList = (props: any) => <FlatList {...props} />;
export const BottomSheetBackdrop = () => null;
export const BottomSheetModalProvider = ({ children }: any) => <>{children}</>;
export const useBottomSheetTimingConfigs = (_config: any) => ({});
export const useBottomSheetSpringConfigs = (_config: any) => ({});
