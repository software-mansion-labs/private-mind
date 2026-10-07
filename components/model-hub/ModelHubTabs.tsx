import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { opacity, radius } from '../../constants/design-system';

export type ModelHubTab = 'featured' | 'experimental' | 'mine';

interface Props {
  value: ModelHubTab;
  onChange: (tab: ModelHubTab) => void;
}

const TABS: { key: ModelHubTab; label: string }[] = [
  { key: 'featured', label: 'Recommended' },
  { key: 'experimental', label: 'Experimental' },
  { key: 'mine', label: 'Mine' },
];

const ModelHubTabs = ({ value, onChange }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onChange(tab.key)}
            activeOpacity={opacity.pressed}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default ModelHubTabs;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.bg.softSecondary,
      borderRadius: radius.full,
      padding: 4,
      gap: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    tabSelected: {
      backgroundColor: theme.bg.main,
    },
    label: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    labelSelected: {
      fontFamily: fontFamily.medium,
      color: theme.text.contrastPrimary,
    },
  });
