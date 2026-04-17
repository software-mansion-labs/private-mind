import React, { useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import CloseIcon from '../assets/icons/close.svg';
import ArrowLeftIcon from '../assets/icons/arrow-left.svg';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes } from '../styles/fontStyles';

interface Props {
  title: string;
  onClose: () => void;
  leftIcon?: 'close' | 'back';
}

const ModalHeader = ({ title, onClose, leftIcon = 'close' }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const Icon = leftIcon === 'back' ? ArrowLeftIcon : CloseIcon;
  const iconSize = leftIcon === 'back' ? 20 : 16;

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity style={styles.iconWrap} onPress={onClose} hitSlop={15}>
        <Icon width={iconSize} height={iconSize} style={styles.icon} />
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
      marginTop:
        Platform.OS === 'android' ? Math.max(0, theme.insets.top - 16) : 0,
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
