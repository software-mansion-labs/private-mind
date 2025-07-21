import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import CloseIcon from '../assets/icons/close.svg';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes } from '../styles/fontStyles';

interface Props {
  title: string;
  onClose: () => void;
}

const ModalHeader = ({ title, onClose }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity style={styles.iconWrap} onPress={onClose}>
        <CloseIcon width={16} height={16} style={styles.icon} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.iconWrap} />
    </View>
  );
};

export default ModalHeader;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      height: 56,
      marginBottom: 16,
    },
    iconWrap: {
      position: 'absolute',
      zIndex: 2,
    },
    icon: {
      color: theme.text.primary,
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      textAlign: 'center',
      flex: 1,
      zIndex: 1,
      color: theme.text.primary,
    },
  });
