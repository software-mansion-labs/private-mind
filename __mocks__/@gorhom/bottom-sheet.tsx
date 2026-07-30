import React, { forwardRef, type PropsWithChildren } from 'react';
import {
  View,
  FlatList,
  type FlatListProps,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';

export interface BottomSheetModalRef {
  present: () => void;
  dismiss: () => void;
}

export type SheetAnimationConfig = Record<string, number | boolean>;

export const BottomSheetModal = forwardRef<
  BottomSheetModalRef,
  PropsWithChildren
>(({ children }, _ref) => <>{children}</>);
BottomSheetModal.displayName = 'BottomSheetModal';

export const BottomSheetView = ({ children, style }: ViewProps) => (
  <View style={style}>{children}</View>
);

export const BottomSheetScrollView = ({
  children,
  contentContainerStyle,
  testID,
}: ScrollViewProps) => (
  <View style={contentContainerStyle} testID={testID}>
    {children}
  </View>
);

export const BottomSheetFlatList = <ItemT,>(props: FlatListProps<ItemT>) => (
  <FlatList {...props} />
);

export const BottomSheetBackdrop = () => null;

export const BottomSheetModalProvider = ({ children }: PropsWithChildren) => (
  <>{children}</>
);

export const useBottomSheet = () => ({ close: () => {} });

export const useBottomSheetTimingConfigs = (config: SheetAnimationConfig) =>
  config;

export const useBottomSheetSpringConfigs = (config: SheetAnimationConfig) =>
  config;
