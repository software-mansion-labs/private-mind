import React from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useDrawer } from '../context/DrawerContext';

interface Props {
  children: React.ReactNode;
  enabled?: boolean;
}

const WithDrawerGesture = ({ children, enabled = true }: Props) => {
  const { openDrawer } = useDrawer();
  const hasOpenedDrawer = useSharedValue(false);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e) => {
      if (e.translationX > 50 && e.velocityX > 300 && !hasOpenedDrawer.value) {
        hasOpenedDrawer.value = true;
        runOnJS(openDrawer)();
      }
    })
    .onEnd(() => {
      hasOpenedDrawer.value = false;
    });

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
};

export default WithDrawerGesture;
