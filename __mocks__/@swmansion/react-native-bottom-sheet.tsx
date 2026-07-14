import React, { type ReactNode } from 'react';
import { View } from 'react-native';

type SheetProps = {
  surface?: ReactNode;
  children?: ReactNode;
};

type DetentValue = number | 'content';

export const BottomSheetProvider = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);

export const ModalBottomSheet = ({ surface, children }: SheetProps) => (
  <View>
    {surface}
    {children}
  </View>
);

export const BottomSheet = ({ surface, children }: SheetProps) => (
  <View>
    {surface}
    {children}
  </View>
);

export const programmatic = (value: DetentValue) => ({
  value,
  programmatic: true,
});
