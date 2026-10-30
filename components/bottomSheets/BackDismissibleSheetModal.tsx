import React, { type Ref, useCallback, useRef, useState } from 'react';
import {
  BottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useBackToDismiss } from '../../hooks/useBackToDismiss';

type Props<T> = BottomSheetModalProps<T> & {
  ref?: Ref<BottomSheetModal<T> | null>;
};

const BackDismissibleSheetModal = <T,>({
  ref,
  onAnimate,
  onChange,
  onDismiss,
  ...props
}: Props<T>) => {
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

  return (
    <BottomSheetModal<T>
      {...props}
      ref={attachRef}
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
