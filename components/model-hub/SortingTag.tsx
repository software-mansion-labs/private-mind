import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily } from '../../styles/fontFamily';

interface Props {
  text: string;
  selected: boolean;
  onPress: () => void;
}

const SortingTag = ({ text, selected, onPress }: Props) => {
  const { theme } = useTheme();

  return (
    <View
      style={{
        ...styles.container,
        borderColor: theme.border.soft,
      }}
    >
      <Text style={{ color: theme.text.primary }}>{text}</Text>
    </View>
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
  },
  text: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
});
