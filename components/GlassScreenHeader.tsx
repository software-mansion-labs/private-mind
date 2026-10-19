import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultHeaderHeight } from 'expo-router/react-navigation';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import ArrowLeftIcon from '../assets/icons/arrow-left.svg';
import HeaderGlassButton, { headerGlassButtonFill } from './HeaderGlassButton';
import { GlassScrollEdge } from './chat-screen/GlassScrollEdge';
import { GLASS_BUTTON_SIZE, HEADER_EDGE_PX } from '../constants/header-actions';
import { space } from '../constants/design-system';

const TITLE_SIDE_SPACE = GLASS_BUTTON_SIZE + HEADER_EDGE_PX * 2;
const SHEET_TOP_INSET = space.four;

const useHeaderTopInset = (sheet: boolean) => {
  const insets = useSafeAreaInsets();
  return sheet && Platform.OS === 'ios' ? SHEET_TOP_INSET : insets.top;
};

export const useGlassScreenHeaderHeight = (sheet = false) => {
  const layout = useWindowDimensions();
  const topInset = useHeaderTopInset(sheet);
  return getDefaultHeaderHeight(layout, sheet, topInset);
};

interface Props {
  title: string;
  onBack: () => void;
  sheet?: boolean;
}

const GlassScreenHeader = ({ title, onBack, sheet = false }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const topInset = useHeaderTopInset(sheet);
  const headerHeight = useGlassScreenHeaderHeight(sheet);

  return (
    <>
      <GlassScrollEdge anchor={headerHeight} />
      <View
        style={[styles.bar, { top: topInset, height: headerHeight - topInset }]}
        pointerEvents="box-none"
      >
        <View style={styles.titleContainer} pointerEvents="none">
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
        <HeaderGlassButton edge="leading">
          <TouchableOpacity
            onPress={onBack}
            style={headerGlassButtonFill}
            hitSlop={15}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="glass-header-back"
          >
            <ArrowLeftIcon width={20} height={20} style={styles.icon} />
          </TouchableOpacity>
        </HeaderGlassButton>
      </View>
    </>
  );
};

export default GlassScreenHeader;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleContainer: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: TITLE_SIDE_SPACE,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    icon: {
      color: theme.text.primary,
    },
  });
