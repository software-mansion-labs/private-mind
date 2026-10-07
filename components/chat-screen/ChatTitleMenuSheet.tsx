import React, { RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';
import SheetBackdrop from '../bottomSheets/SheetBackdrop';
import { createSheetStyles } from '../bottomSheets/sheetStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import EditIcon from '../../assets/icons/edit.svg';
import UploadIcon from '../../assets/icons/upload.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import MenuRow from '../menu/MenuRow';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  title: string;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDismiss?: () => void;
}

const ChatTitleMenuSheet = ({
  bottomSheetModalRef,
  title,
  onRename,
  onShare,
  onDelete,
  onDismiss,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const { styles: sheet } = useThemedStyles(createSheetStyles);

  const handleOption = (action: () => void) => {
    bottomSheetModalRef.current?.dismiss();
    action();
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      onDismiss={onDismiss}
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
      }}
      backdropComponent={SheetBackdrop}
      handleStyle={sheet.handle}
      handleIndicatorStyle={sheet.handleIndicator}
      backgroundStyle={sheet.background}
    >
      <BottomSheetView style={styles.container}>
        <Text numberOfLines={1} style={styles.title} testID="chat-menu-title">
          {title}
        </Text>
        <MenuRow
          icon={UploadIcon}
          label="Share"
          onPress={() => handleOption(onShare)}
        />
        <MenuRow
          icon={EditIcon}
          label="Rename"
          onPress={() => handleOption(onRename)}
        />
        <MenuRow
          icon={TrashIcon}
          label="Delete"
          destructive
          onPress={() => {
            Feedback.destructive();
            handleOption(onDelete);
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ChatTitleMenuSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: theme.insets.bottom + space.four,
      gap: 4,
    },
    title: {
      paddingHorizontal: 8,
      paddingBottom: 8,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
  });
