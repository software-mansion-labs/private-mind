import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

interface Props {
  title: string;
  icon?: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
}

const Chip = ({
  title,
  icon,
  backgroundColor,
  textColor,
  borderColor,
}: Props) => {
  const { theme } = useTheme();

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: backgroundColor || 'none',
        borderColor: borderColor || theme.bg.strongPrimary,
      }}
    >
      {icon}
      <Text style={{ ...styles.text, color: textColor || theme.text.primary }}>
        {title}
      </Text>
    </View>
  );
};

export default Chip;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 4,
  },
  text: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.xs,
  },
});
