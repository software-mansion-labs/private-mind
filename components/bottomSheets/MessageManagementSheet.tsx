import React, { RefObject, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
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

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={{
          backgroundColor: theme.bg.overlay,
        }}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={true}
      handleStyle={{
        backgroundColor: theme.bg.softPrimary,
        borderRadius: 16,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
      backgroundStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
    >
      {(props) => {
        return (
          <BottomSheetView
            style={{
              ...styles.bottomSheet,
              backgroundColor: theme.bg.softPrimary,
            }}
          >
            <EntryButton
              text="Copy to clipboard"
              icon={
                <CopyIcon
                  width={19}
                  height={20}
                  style={{ color: theme.bg.strongPrimary }}
                />
              }
              onPress={() => {
                Clipboard.setString(props.data);
                Toast.show({
                  type: 'defaultToast',
                  text1: 'Message copied to your clipboard',
                });
              }}
            />
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default MessageManagementSheet;

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  modelItemText: {
    fontSize: 16,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 36,
  },
  bottomSheetSubText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
});
