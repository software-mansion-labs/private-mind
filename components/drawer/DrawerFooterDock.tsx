import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { getDrawerFooterHeight } from '../../constants/drawer-layout';
import { GlassScrollEdge } from '../chat-screen/GlassScrollEdge';
import { DrawerFooter } from './DrawerFooter';

interface Props {
  onNavigate?: () => void;
  newChatCollapse?: SharedValue<number>;
  width: number;
  opacity?: SharedValue<number>;
  hidden: boolean;
}

export const DrawerFooterDock = ({
  onNavigate,
  newChatCollapse,
  width,
  opacity,
  hidden,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const fallbackOpacity = useSharedValue(1);
  const opacityValue = opacity ?? fallbackOpacity;

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacityValue.get(),
  }));

  return (
    <Animated.View
      style={[styles.layer, fadeStyle]}
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      <GlassScrollEdge
        edge="bottom"
        anchor={getDrawerFooterHeight(theme.insets.bottom)}
      />
      <View style={[styles.footer, { width }]}>
        <DrawerFooter
          onNavigate={onNavigate}
          newChatCollapse={newChatCollapse}
        />
      </View>
    </Animated.View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    layer: {
      ...StyleSheet.absoluteFill,
    },
    footer: {
      position: 'absolute',
      left: 0,
      bottom: 0,
    },
  });
