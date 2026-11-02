import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import PlusIcon from '../../assets/icons/plus.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

const FloatingActionButton = ({ onPress, disabled = false }: Props) => {
  const { styles } = useThemedStyles(createStyles, disabled);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && pressedOpacity]}
      onPress={onPress}
      disabled={disabled}
    >
      <PlusIcon width={18} height={18} style={styles.icon} />
    </Pressable>
  );
};

export default FloatingActionButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      right: 20,
      bottom: 16 + theme.insets.bottom,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: disabled ? theme.text.defaultTertiary : theme.bg.main,
    },
    icon: {
      color: disabled
        ? theme.text.defaultSecondary
        : theme.text.contrastPrimary,
    },
  });
