import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { EdgeFade } from './EdgeFade';
import {
  FADE_GAP_TRIM,
  FADE_HEIGHT,
  SEAM_OVERLAP,
} from '../../constants/chat-screen';

export const topFadeHeight = (anchor: number) =>
  anchor - FADE_GAP_TRIM + FADE_HEIGHT;

const MASK_COLOR = '#000000';

interface Props {
  anchor: number;
  backdrop?: React.ReactNode;
  backdropHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export const TopFade = React.memo(
  ({ anchor, backdrop, backdropHeight = 0, style }: Props) => {
    const solidHeight = anchor - FADE_GAP_TRIM;
    const { styles } = useThemedStyles(
      createStyles,
      solidHeight,
      backdropHeight
    );

    if (solidHeight <= 0) return null;

    if (backdrop) {
      return (
        <MaskedView
          style={[styles.container, style]}
          pointerEvents="none"
          maskElement={
            <View style={styles.container}>
              <View style={[styles.solid, styles.mask]} />
              <EdgeFade edge="top" color={MASK_COLOR} style={styles.ramp} />
            </View>
          }
        >
          <View style={styles.backdrop}>{backdrop}</View>
        </MaskedView>
      );
    }

    return (
      <View style={[styles.container, style]} pointerEvents="none">
        <View style={styles.solid} />
        <EdgeFade edge="top" style={styles.ramp} />
      </View>
    );
  }
);

TopFade.displayName = 'TopFade';

const createStyles = (
  theme: Theme,
  solidHeight: number,
  backdropHeight: number
) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: solidHeight + FADE_HEIGHT,
    },
    solid: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: solidHeight + SEAM_OVERLAP,
      backgroundColor: theme.bg.softPrimary,
    },
    mask: {
      backgroundColor: MASK_COLOR,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: backdropHeight,
    },
    ramp: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: FADE_HEIGHT,
    },
  });
