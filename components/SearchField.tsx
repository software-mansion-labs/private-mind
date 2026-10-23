import React, { Ref } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { TEXT_SELECTION, Theme } from '../styles/colors';
import { radius, space } from '../constants/design-system';
import SearchIcon from '../assets/icons/search.svg';

const FIELD_HEIGHT = 44;
export const SEARCH_ICON_SIZE = 18;

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SearchFieldSurface = ({ children, style }: SurfaceProps) => {
  const { styles } = useThemedStyles(createStyles);

  return <View style={[styles.surface, style]}>{children}</View>;
};

export const SearchFieldIcon = () => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <SearchIcon
      width={SEARCH_ICON_SIZE}
      height={SEARCH_ICON_SIZE}
      style={styles.icon}
    />
  );
};

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  leading?: React.ReactNode;
  inputRef?: Ref<TextInput>;
};

const SearchField = ({
  value,
  onChangeText,
  leading = <SearchFieldIcon />,
  inputRef,
  ...props
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <SearchFieldSurface>
      {leading}
      <TextInput
        {...TEXT_SELECTION}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme.text.defaultTertiary}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        {...props}
      />
    </SearchFieldSurface>
  );
};

export default SearchField;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    surface: {
      minHeight: FIELD_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.twoHalf,
      paddingHorizontal: 14,
      borderRadius: radius.full,
      backgroundColor: theme.bg.softTertiary,
    },
    icon: {
      color: theme.text.defaultTertiary,
    },
    input: {
      flex: 1,
      paddingVertical: space.twoHalf,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
