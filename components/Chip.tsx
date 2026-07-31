import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';

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
  const { styles } = useThemedStyles(
    createStyles,
    backgroundColor,
    textColor,
    borderColor
  );

  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.text}>{title}</Text>
    </View>
  );
};

export default Chip;

const createStyles = (
  theme: Theme,
  backgroundColor?: string,
  textColor?: string,
  borderColor?: string
) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 100,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      gap: 4,
      backgroundColor: backgroundColor ?? 'transparent',
      borderColor: borderColor ?? theme.bg.strongPrimary,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: textColor ?? theme.text.primary,
    },
  });
