import React, { RefObject, useCallback, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native';
import { Theme } from '../../styles/colors';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import EntryButton from '../EntryButton';
import CopyIcon from '../../assets/icons/copy.svg';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const MessageManagementSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      {(props) => (
        <BottomSheetView style={styles.content}>
          <EntryButton
            text="Copy to clipboard"
            icon={<CopyIcon width={19} height={20} style={styles.icon} />}
            onPress={() => {
              Clipboard.setString(props.data);
              Toast.show({
                type: 'defaultToast',
                text1: 'Message copied to clipboard',
              });
            }}
          />
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default MessageManagementSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      paddingBottom: 36,
      gap: 24,
      backgroundColor: theme.bg.softPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handle: {
      borderRadius: 16,
      backgroundColor: theme.bg.softPrimary,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    background: {
      backgroundColor: theme.bg.softPrimary,
    },
    icon: {
      color: theme.bg.strongPrimary,
    },
  });
