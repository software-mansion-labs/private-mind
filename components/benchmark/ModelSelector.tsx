import React, { Dispatch, SetStateAction, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Theme } from '../../styles/colors';

interface Props {
  model?: Model | null;
  setSelectedModel: Dispatch<SetStateAction<Model | undefined>>;
}

export const ModelSelector = ({ model, setSelectedModel }: Props) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <View style={styles.wrapper}>
        <Text style={styles.label}>Model</Text>
        {model ? (
          <ModelCard
            model={model}
            onPress={() => bottomSheetModalRef.current?.present()}
          />
        ) : (
          <TouchableOpacity
            style={styles.selectorContainer}
            onPress={() => bottomSheetModalRef.current?.present()}
          >
            <Text style={styles.selectorText}>Select a model</Text>
            <ChevronDownIcon width={18} height={10} style={styles.icon} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: 16,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    selectorContainer: {
      padding: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.border.soft,
      gap: 16,
      height: 84,
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: 'row',
    },
    selectorText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    icon: {
      color: theme.text.primary,
    },
  });
