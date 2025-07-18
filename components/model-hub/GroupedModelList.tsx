import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Model } from '../../database/modelRepository';
import ModelCard from './ModelCard';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontSizes, fontFamily } from '../../styles/fontStyles';

interface Props {
  groupedModels: Record<string, Model[]>;
  onModelPress: (model: Model) => void;
}

const GroupedModelList = ({ groupedModels, onModelPress }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      {Object.entries(groupedModels).map(([prefix, group]) => (
        <React.Fragment key={prefix}>
          <Text style={styles.sectionHeader}>{prefix}</Text>
          <View style={styles.modelList}>
            {group.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onPress={() => onModelPress(model)}
              />
            ))}
          </View>
        </React.Fragment>
      ))}
    </>
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
    modelList: {
      gap: 8,
    },
  });
