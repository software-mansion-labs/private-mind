import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import CloseIcon from '../../assets/icons/cross-small.svg';

interface Props {
  onPress: () => void;
}

function CloseButton({ onPress }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <TouchableOpacity style={styles.wrapper} onPress={onPress}>
      <CloseIcon color={theme.text.primary} />
    </TouchableOpacity>
  );
}

export default CloseButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: theme.bg.softPrimary,
      width: 32,
      height: 32,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
