import React, { type Ref, useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useBackToDismiss } from '../../hooks/useBackToDismiss';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';
import {
  SHEET_HANDLE_INDICATOR_HEIGHT,
  SHEET_HANDLE_INDICATOR_WIDTH,
  SHEET_HANDLE_PADDING,
  SHEET_RADIUS,
} from '../../constants/bottom-sheet';

type Props<T> = BottomSheetModalProps<T> & {
  ref?: Ref<BottomSheetModal<T> | null>;
};

const BackDismissibleSheetModal = <T,>({
  ref,
  onAnimate,
  onChange,
  onDismiss,
  backdropComponent,
  handleStyle,
  handleIndicatorStyle,
  backgroundStyle,
  ...props
}: Props<T>) => {
  const { styles } = useThemedStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal<T> | null>(null);
  const [open, setOpen] = useState(false);

  useBackToDismiss(open, () => sheetRef.current?.dismiss());

  const attachRef = useCallback(
    (sheet: BottomSheetModal<T> | null) => {
      sheetRef.current = sheet;
      if (typeof ref === 'function') ref(sheet);
      else if (ref) ref.current = sheet;
    },
    [ref]
  );

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={[backdropProps.style, styles.backdrop]}
      />
    ),
    [styles.backdrop]
  );

  return (
    <BottomSheetModal<T>
      {...props}
      ref={attachRef}
      backdropComponent={backdropComponent ?? renderBackdrop}
      handleStyle={[styles.handle, handleStyle]}
      handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
      backgroundStyle={[styles.background, backgroundStyle]}
      onAnimate={(fromIndex, toIndex, fromPosition, toPosition) => {
        setOpen(toIndex >= 0);
        onAnimate?.(fromIndex, toIndex, fromPosition, toPosition);
      }}
      onChange={(index, position, type) => {
        setOpen(index >= 0);
        onChange?.(index, position, type);
      }}
      onDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
    />
  );
};

export default BackDismissibleSheetModal;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handle: {
      paddingVertical: SHEET_HANDLE_PADDING,
      borderTopLeftRadius: SHEET_RADIUS,
      borderTopRightRadius: SHEET_RADIUS,
      backgroundColor: theme.bg.softPrimary,
    },
    handleIndicator: {
      width: SHEET_HANDLE_INDICATOR_WIDTH,
      height: SHEET_HANDLE_INDICATOR_HEIGHT,
      borderRadius: radius.full,
      backgroundColor: theme.border.soft,
    },
    background: {
      borderRadius: SHEET_RADIUS,
      backgroundColor: theme.bg.softPrimary,
    },
  });
