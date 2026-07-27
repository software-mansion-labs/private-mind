import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import InfoCircleIcon from '../assets/icons/info-circle.svg';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';

interface Props {
  text: string;
}

export const InfoAlert = ({ text }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <InfoCircleIcon
        width={20}
        height={20}
        fillOpacity={0.6}
        style={styles.icon}
      />
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
