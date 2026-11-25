import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { space } from '../../constants/design-system';
import SettingsRowGroup from './SettingsRowGroup';
import SectionHeader from '../model-hub/SectionHeader';

interface Props {
  title: string;
  children: React.ReactNode;
}

export const SettingsGroup = ({ title, children }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.group}>
      <SectionHeader title={title} />
      <SettingsRowGroup separatorInset={0}>{children}</SettingsRowGroup>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    group: {
      gap: space.two,
    },
  });
