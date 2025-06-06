import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import CloseIcon from '../assets/icons/close.svg';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { useTheme } from '../context/ThemeContext';

interface Props {
  title: string;
  onClose: () => void;
}

const ModalHeader = ({ title, onClose }: Props) => {
  const { theme } = useTheme();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.iconWrap}
        onPress={() => {
          console.log('Close modal');
          onClose();
        }}
      >
        <CloseIcon width={16} height={16} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>

      <View style={styles.iconWrap} />
    </View>
  );
};

const styles = StyleSheet.create({
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
  title: {
    fontSize: fontSizes.fontSizeMd,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
    flex: 1,
    zIndex: 1,
  },
});

export default ModalHeader;
