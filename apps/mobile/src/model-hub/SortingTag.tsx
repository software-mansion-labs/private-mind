import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import CheckIcon from '../../assets/icons/check.svg';

interface Props {
  text: string;
  selected: boolean;
  onPress: () => void;
}

const SortingTag = ({ text, selected, onPress }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(
    () => createStyles(theme, selected),
    [theme, selected]
  );

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.text}>{text}</Text>
      {selected && <CheckIcon width={20} height={20} style={styles.icon} />}
      <View style={styles.border} />
    </TouchableOpacity>
  );
};

export default SortingTag;

const createStyles = (theme: Theme, selected: boolean) =>
  StyleSheet.create({
    container: {
      gap: 8,
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 9999,
      flexDirection: 'row',
      maxHeight: 44,
      minHeight: 20,
    },
    text: {
      fontFamily: selected ? fontFamily.medium : fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
      marginVertical: 12,
    },
    icon: {
      color: theme.text.primary,
    },
    border: {
      pointerEvents: 'none',
      ...StyleSheet.absoluteFillObject,
      borderRadius: 9999,
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
    },
  });
