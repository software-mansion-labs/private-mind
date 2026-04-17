import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';

export type ModelHubTab = 'featured' | 'experimental' | 'mine';

interface Props {
  value: ModelHubTab;
  onChange: (tab: ModelHubTab) => void;
}

const TABS: { key: ModelHubTab; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'experimental', label: 'Experimental' },
  { key: 'mine', label: 'Mine' },
];

const ModelHubTabs = ({ value, onChange }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onChange(tab.key)}
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
      borderRadius: 9999,
      padding: 4,
      gap: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9999,
    },
    tabSelected: {
      backgroundColor: theme.bg.softPrimary,
    },
    label: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    labelSelected: {
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
