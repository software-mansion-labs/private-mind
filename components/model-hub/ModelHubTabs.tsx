import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { radius, space, stroke } from '../../constants/design-system';

export type ModelHubTab = 'featured' | 'experimental' | 'mine';

interface Props {
  value: ModelHubTab;
  onChange: (tab: ModelHubTab) => void;
  edgeInset?: number;
}

const TAB_HEIGHT = 36;

const TABS: { key: ModelHubTab; label: string }[] = [
  { key: 'featured', label: 'Recommended' },
  { key: 'experimental', label: 'Experimental' },
  { key: 'mine', label: 'Mine' },
];

const ModelHubTabs = ({ value, onChange, edgeInset = 0 }: Props) => {
  const { styles } = useThemedStyles(createStyles, edgeInset);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
      accessibilityLabel="Model lists"
    >
      {TABS.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabSelected,
              pressed && !selected && styles.pressed,
            ]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`model-hub-tab-${tab.key}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default ModelHubTabs;

const createStyles = (theme: Theme, edgeInset: number) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -edgeInset,
    },
    content: {
      gap: space.two,
      paddingHorizontal: edgeInset,
    },
    tab: {
      height: TAB_HEIGHT,
      paddingHorizontal: space.four,
      justifyContent: 'center',
      borderRadius: radius.full,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    tabSelected: {
      backgroundColor: theme.bg.main,
      borderColor: theme.bg.main,
    },
    pressed: {
      backgroundColor: theme.bg.softTertiary,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    labelSelected: {
      color: theme.text.onBrand,
    },
  });
