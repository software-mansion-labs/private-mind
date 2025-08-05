import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollViewProps } from 'react-native';
import { Model } from '../../database/modelRepository';
import ModelCard from './ModelCard';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { ScrollView } from 'react-native-gesture-handler';

interface ModelGroup {
  label: string;
  models: Model[];
}

interface Props
  extends Pick<React.ComponentProps<typeof ModelCard>, 'memoryWarningSheetRef'>,
    Pick<ScrollViewProps, 'contentContainerStyle'> {
  groupedModels: ModelGroup[];
  onModelPress: (model: Model) => void;
}

const GroupedModelList = ({
  groupedModels,
  onModelPress,
  memoryWarningSheetRef,
  contentContainerStyle,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContainer, contentContainerStyle]}
    >
      {groupedModels
        .filter(({ models }) => models.length > 0)
        .map(({ label, models }) => (
          <React.Fragment key={label}>
            <Text style={styles.sectionHeader}>{label}</Text>
            <View style={styles.modelList}>
              {models.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onPress={() => onModelPress(model)}
                  memoryWarningSheetRef={memoryWarningSheetRef}
                />
              ))}
            </View>
          </React.Fragment>
        ))}
    </ScrollView>
  );
};

export default GroupedModelList;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sectionHeader: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
      textTransform: 'capitalize',
    },
    scrollContainer: {
      gap: 16,
    },
    modelList: {
      gap: 8,
    },
  });
