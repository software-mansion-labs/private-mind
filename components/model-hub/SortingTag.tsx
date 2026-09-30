import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import CheckIcon from '../../assets/icons/check.svg';
import { pressedOpacity } from '../../styles/pressable';

interface Props {
  text: string;
  selected: boolean;
  onPress: () => void;
}

const SortingTag = ({ text, selected, onPress }: Props) => {
  const { styles } = useThemedStyles(createStyles, selected);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && pressedOpacity]}
      onPress={onPress}
    >
      <Text style={styles.text}>{text}</Text>
      {selected && <CheckIcon width={20} height={20} style={styles.icon} />}
      <View style={styles.border} />
    </Pressable>
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
      ...StyleSheet.absoluteFill,
      borderRadius: 9999,
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
    },
  });
