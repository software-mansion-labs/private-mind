import React from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import {
  CONTENT_PADDING,
  LABEL_ICON_SIZE,
  OnboardingSlide as Slide,
} from '../../constants/onboarding';

interface Props {
  slide: Slide;
  leading?: boolean;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  badgeStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  titleStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

function OnboardingCaption({
  slide,
  leading = false,
  isActive = true,
  style,
  badgeStyle,
  titleStyle,
  onLayout,
}: Props) {
  const { styles } = useThemedStyles(createStyles);
  const Icon = slide.icon.art;
  const iconHeight = LABEL_ICON_SIZE * (slide.icon.scale ?? 1);

  return (
    <View
      style={[styles.textBlock, leading && styles.textBlockLeading, style]}
      onLayout={onLayout}
      accessible={isActive}
      accessibilityElementsHidden={!isActive}
      importantForAccessibility={isActive ? 'yes' : 'no-hide-descendants'}
      accessibilityLabel={`${slide.label}. ${slide.title}`}
    >
      <Animated.View style={[styles.labelBadge, badgeStyle]}>
        <Icon
          width={iconHeight * slide.icon.aspectRatio}
          height={iconHeight}
          style={styles.labelIcon}
        />
        <Text style={styles.labelText}>{slide.label}</Text>
      </Animated.View>
      <Animated.Text
        style={[styles.title, leading && styles.titleLeading, titleStyle]}
      >
        {slide.title}
      </Animated.Text>
    </View>
  );
}

export default React.memo(OnboardingCaption);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    textBlock: {
      paddingHorizontal: CONTENT_PADDING,
      alignItems: 'center',
      gap: 12,
    },
    textBlockLeading: {
      alignItems: 'flex-start',
    },
    labelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.bg.onBrandSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    labelIcon: {
      color: theme.text.onBrand,
    },
    labelText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      textAlign: 'center',
      color: theme.text.onBrand,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxl,
      lineHeight: lineHeights.xxl,
      textAlign: 'center',
      color: theme.text.onBrand,
    },
    titleLeading: {
      textAlign: 'left',
    },
  });
