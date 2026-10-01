import React, { RefObject } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
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
  onExport: () => void;
  onDelete: () => void;
  onDismiss?: () => void;
}

const ChatTitleMenuSheet = ({
  bottomSheetModalRef,
  title,
  onRename,
  onExport,
  onDelete,
  onDismiss,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

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
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
      backgroundStyle={{ backgroundColor: theme.bg.softPrimary }}
      handleIndicatorStyle={{ backgroundColor: theme.border.soft }}
    >
      <BottomSheetView style={styles.container}>
        <Text numberOfLines={1} style={styles.title} testID="chat-menu-title">
          {title}
        </Text>
        <MenuRow
          icon={EditIcon}
          label="Rename"
          onPress={() => handleOption(onRename)}
        />
        <MenuRow
          icon={UploadIcon}
          label="Export Chat"
          onPress={() => handleOption(onExport)}
        />
        <MenuRow
          icon={TrashIcon}
          label="Delete Chat"
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
      paddingBottom: 32,
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
