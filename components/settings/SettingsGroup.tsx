import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { space, textStyles } from '../../constants/design-system';
import SettingsRowGroup from './SettingsRowGroup';
import SectionHeader from '../model-hub/SectionHeader';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup = ({ title, description, children }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <SectionHeader title={title} />
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <SettingsRowGroup separatorInset={0}>{children}</SettingsRowGroup>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: {
      gap: space.two,
    },
    header: {
      gap: space.half,
    },
    description: {
      ...textStyles.bodySecondaryRegular,
      paddingHorizontal: space.one,
      color: theme.text.defaultTertiary,
    },
  });
