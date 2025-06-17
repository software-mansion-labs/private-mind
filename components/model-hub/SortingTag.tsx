import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import CheckIcon from '../../assets/icons/check.svg';

interface Props {
  text: string;
  selected: boolean;
  onPress: () => void;
}

const SortingTag = ({ text, selected, onPress }: Props) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={
        selected
          ? {
              ...styles.container,
              borderColor: theme.bg.strongPrimary,
              borderWidth: 2,
            }
          : {
              ...styles.container,
              borderColor: theme.border.soft,
            }
      }
      onPress={onPress}
    >
      <Text
        style={
          selected
            ? {
                ...styles.text,
                fontFamily: fontFamily.medium,
                color: theme.text.primary,
              }
            : { ...styles.text, color: theme.text.primary }
        }
      >
        {text}
      </Text>
      {selected && (
        <CheckIcon
          width={20}
          height={20}
          style={{ color: theme.text.primary }}
        />
      )}
    </TouchableOpacity>
  );
};

export default SortingTag;

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    maxHeight: 44,
  },
  text: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
});
