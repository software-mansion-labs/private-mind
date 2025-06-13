import React, { Dispatch, RefObject, SetStateAction, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

interface Props {
  model?: Model | null;
  setSelectedModel: Dispatch<SetStateAction<Model | null>>;
}

export const ModelSelector = ({ model, setSelectedModel }: Props) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { theme } = useTheme();

  return (
    <>
      <View style={{ gap: 16 }}>
        <Text style={{ ...styles.label, color: theme.text.primary }}>
          Model
        </Text>
        {model ? (
          <ModelCard
            model={model}
            onPress={() => {
              bottomSheetModalRef.current?.present();
            }}
          />
        ) : (
          <TouchableOpacity
            style={{
              ...styles.selectorContainer,
              borderColor: theme.border.soft,
            }}
            onPress={() => {
              bottomSheetModalRef.current?.present();
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.medium,
                fontSize: fontSizes.md,
                color: theme.text.primary,
              }}
            >
              Select a model
            </Text>
            <ChevronDownIcon
              width={18}
              height={10}
              style={{ color: theme.text.primary }}
            />
          </TouchableOpacity>
        )}
      </View>
      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        selectModel={setSelectedModel}
      />
    </>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  selectorContainer: {
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    gap: 16,
    height: 84,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
});
