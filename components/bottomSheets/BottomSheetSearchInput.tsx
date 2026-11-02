import React from 'react';
import { StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { TEXT_SELECTION, Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';
import { SearchFieldIcon, SearchFieldSurface } from '../SearchField';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
}

const BottomSheetSearchInput = ({
  value,
  onChangeText,
  placeholder,
  style,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <SearchFieldSurface style={style}>
      <SearchFieldIcon />
      <BottomSheetTextInput
        {...TEXT_SELECTION}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
    </SearchFieldSurface>
  );
};

export default BottomSheetSearchInput;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    input: {
      flex: 1,
      paddingVertical: space.twoHalf,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
