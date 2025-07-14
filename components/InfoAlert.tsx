import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import InfoCircleIcon from '../assets/icons/info-circle.svg';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

interface Props {
  text: string;
}

export const InfoAlert = ({ text }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <InfoCircleIcon width={20} height={20} style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.alertText}>{text}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      borderRadius: 4,
      padding: 12,
      gap: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    icon: {
      color: theme.text.primary,
    },
    textWrapper: {
      paddingRight: 12,
      flex: 1,
    },
    alertText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
  });
