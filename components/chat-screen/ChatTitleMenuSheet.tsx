import React, { RefObject, useRef, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Text, StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import EditIcon from '../../assets/icons/edit.svg';
import UploadIcon from '../../assets/icons/upload.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import MenuRow from '../menu/MenuRow';
import { Feedback } from '../../utils/Feedback';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';

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

  const optionChosen = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleOption = (action: () => void) => {
    if (optionChosen.current) return;
    optionChosen.current = true;
    bottomSheetModalRef.current?.dismiss();
    action();
  };

  const handleDismiss = () => {
    optionChosen.current = false;
    setConfirmingDelete(false);
    onDismiss?.();
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      onDismiss={handleDismiss}
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
        {confirmingDelete ? (
          <View
            style={styles.confirmation}
            testID="chat-menu-delete-confirmation"
          >
            <Text style={styles.confirmationTitle}>Delete Chat</Text>
            <Text style={styles.confirmationText}>
              Are you sure you want to delete this chat?
            </Text>
            <View style={styles.confirmationButtons}>
              <PrimaryButton
                style={styles.deleteButton}
                text="Delete"
                onPress={() => handleOption(onDelete)}
              />
              <SecondaryButton
                text="Cancel"
                onPress={() => setConfirmingDelete(false)}
              />
            </View>
          </View>
        ) : (
          <>
            <Text
              numberOfLines={1}
              style={styles.title}
              testID="chat-menu-title"
            >
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
                setConfirmingDelete(true);
              }}
            />
          </>
        )}
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
    confirmation: {
      paddingTop: 8,
      gap: 24,
    },
    confirmationTitle: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    confirmationText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    confirmationButtons: {
      gap: 8,
    },
    deleteButton: {
      backgroundColor: theme.bg.errorPrimary,
    },
  });
