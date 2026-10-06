import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  BottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useBackToClose } from '../../hooks/useBackToClose';

const BackClosableBottomSheetModal = forwardRef<
  BottomSheetModal,
  BottomSheetModalProps
>(({ onChange, onDismiss, ...props }, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal, []);
  useBackToClose(isOpen, () => sheetRef.current?.dismiss());

  return (
    <BottomSheetModal
      {...props}
      ref={sheetRef}
      onChange={(index, position, type) => {
        setIsOpen(index >= 0);
        onChange?.(index, position, type);
      }}
      onDismiss={() => {
        setIsOpen(false);
        onDismiss?.();
      }}
    />
  );
});

BackClosableBottomSheetModal.displayName = 'BackClosableBottomSheetModal';

export default BackClosableBottomSheetModal;
