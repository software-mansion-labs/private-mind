import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import InfoCircleIcon from '../assets/icons/info-circle.svg';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { useTheme } from '../context/ThemeContext';

interface Props {
  text: string;
}

export const InfoAlert = ({ text }: Props) => {
  const { theme } = useTheme();

  return (
    <View style={{ ...styles.container, borderColor: theme.border.soft }}>
      <InfoCircleIcon
        width={20}
        height={20}
        style={{ color: theme.text.primary }}
      />
      <View style={{ paddingRight: 12 }}>
        <Text style={{ ...styles.alertText, color: theme.text.primary }}>
          {text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    padding: 12,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  alertText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
    paddingRight: 12,
  },
});
