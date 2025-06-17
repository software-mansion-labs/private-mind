import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Divider } from '../Divider';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

const DeviceInfoCard = ({
  deviceInfo,
}: {
  deviceInfo: { model: string; systemVersion: string; memory: string };
}) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border.soft }]}>
      <View style={styles.data}>
        <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
          Device Used
        </Text>
        <Text style={[styles.result, { color: theme.text.primary }]}>
          {deviceInfo.model}
        </Text>
      </View>
      <Divider />
      <View style={styles.row}>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            System Version
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {deviceInfo.systemVersion}
          </Text>
        </View>
        <View style={styles.data}>
          <Text style={[styles.label, { color: theme.text.defaultSecondary }]}>
            Total Memory
          </Text>
          <Text style={[styles.result, { color: theme.text.primary }]}>
            {deviceInfo.memory}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    gap: 16,
    flexDirection: 'column',
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
  },
  result: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.md,
  },
});

export default DeviceInfoCard;
