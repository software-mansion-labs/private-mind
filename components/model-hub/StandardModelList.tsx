import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Model } from '../../database/modelRepository';
import ModelCard from './ModelCard';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';

interface Props {
  downloadedModels: Model[];
  availableModels: Model[];
  onModelPress: (model: Model) => void;
  memoryWarningSheetRef: any;
}

const StandardModelList = ({
  downloadedModels,
  availableModels,
  onModelPress,
  memoryWarningSheetRef,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      {downloadedModels.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Ready to Use</Text>
          <View style={styles.modelList}>
            {downloadedModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onPress={() => onModelPress(model)}
                bottomSheetModalRef={memoryWarningSheetRef}
              />
            ))}
          </View>
        </>
      )}
      <Text style={styles.sectionHeader}>Available to Download</Text>
      <View style={styles.downloadList}>
        {availableModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onPress={() => onModelPress(model)}
            bottomSheetModalRef={memoryWarningSheetRef}
          />
        ))}
      </View>
    </>
  );
};

export default StandardModelList;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sectionHeader: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
      textTransform: 'capitalize',
    },
    modelList: {
      gap: 8,
    },
    downloadList: {
      gap: 8,
      paddingBottom: 60,
    },
  });
