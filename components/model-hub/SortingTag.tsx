import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import CheckIcon from '../../assets/icons/check.svg';
import { iconSize, opacity, radius } from '../../constants/design-system';

interface Props {
  text: string;
  selected: boolean;
  onPress: () => void;
}

const SortingTag = ({ text, selected, onPress }: Props) => {
  const { styles } = useThemedStyles(createStyles, selected);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={opacity.pressed}
    >
      <Text style={styles.text}>{text}</Text>
      {selected && (
        <CheckIcon
          width={iconSize.md}
          height={iconSize.md}
          style={styles.icon}
        />
      )}
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
      borderRadius: radius.full,
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
      ...StyleSheet.absoluteFill,
      borderRadius: radius.full,
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
    },
  });
