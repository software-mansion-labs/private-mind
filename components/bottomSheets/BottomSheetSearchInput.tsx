import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SearchIcon from '../../assets/icons/search.svg';
import TextInputBorder from '../TextInputBorder';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  style?: any;
}

const BottomSheetSearchInput = ({
  value,
  onChangeText,
  placeholder,
  style,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [active, setActive] = useState(false);

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputWrapper}>
        <TextInputBorder active={active} />
        <SearchIcon width={20} height={20} style={styles.searchIcon} />
        <BottomSheetTextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.text.defaultTertiary}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
        />
      </View>
    </View>
  );
};

export default BottomSheetSearchInput;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    inputWrapper: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      width: '90%',
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
      lineHeight: 22,
    },
    searchIcon: {
      color: theme.text.primary,
    },
  });