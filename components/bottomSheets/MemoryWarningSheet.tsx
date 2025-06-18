import React, { RefObject, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useModelStore } from '../../store/modelStore';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const MemoryWarningSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const { downloadModel } = useModelStore();

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
            <Text style={{ ...styles.title, color: theme.text.primary }}>
              Your device doesn’t have enough RAM memory to download this model.
            </Text>
            <Text
              style={{
                ...styles.bottomSheetSubText,
                color: theme.text.defaultSecondary,
              }}
            >
              There is a high chance that you won’t be able to download and use
              this model.
            </Text>
            <View style={{ gap: 8 }}>
              <PrimaryButton
                style={{ backgroundColor: theme.bg.errorPrimary }}
                text="Download anyway"
                onPress={async () => {
                  downloadModel(props.data);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
              <SecondaryButton
                text="Cancel"
                onPress={() => {
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            </View>
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 36,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
  bottomSheetSubText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
  },
});

export default MemoryWarningSheet;
