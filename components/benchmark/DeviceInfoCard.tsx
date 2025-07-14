import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Divider } from '../Divider';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

interface Props {
  deviceInfo: {
    model: string;
    systemVersion: string;
    memory: string;
  };
}

const DeviceInfoCard = ({ deviceInfo }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.data}>
        <Text style={styles.label}>Device Used</Text>
        <Text style={styles.result}>{deviceInfo.model}</Text>
      </View>

      <Divider />

      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={styles.label}>System Version</Text>
          <Text style={styles.result}>{deviceInfo.systemVersion}</Text>
        </View>
        <View style={styles.data}>
          <Text style={styles.label}>Total Memory</Text>
          <Text style={styles.result}>{deviceInfo.memory}</Text>
        </View>
      </View>
    </View>
  );
};

export default DeviceInfoCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 4,
      padding: 16,
      gap: 16,
      flexDirection: 'column',
      backgroundColor: theme.bg.softPrimary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    data: {
      width: '50%',
      gap: 4,
    },
    label: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    result: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
