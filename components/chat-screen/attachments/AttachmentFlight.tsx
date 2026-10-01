import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import {
  COMPOSER,
  COMPOSER_STRIP_HEIGHT,
  GRID,
  GUTTER,
  mix,
  panelPalette,
  type Frame,
} from './constants';
import type { LibraryPhoto } from './usePhotoLibrary';

export interface Flight {
  photo: LibraryPhoto;
  from: Frame;
  slot: number;
  fromRadius?: number;
}

interface FlyingPhotoProps {
  flight: Flight;
  screenWidth: number;
  attach: SharedValue<number>;
  strip: SharedValue<number>;
  composerBottom: SharedValue<number>;
  rowsBelowStrip: SharedValue<number>;
}

const FlyingPhoto = ({
  flight,
  screenWidth,
  attach,
  strip,
  composerBottom,
  rowsBelowStrip,
}: FlyingPhotoProps) => {
  const { styles } = useThemedStyles(createStyles);

  const style = useAnimatedStyle(() => {
    const a = attach.get();

    const stripTop =
      composerBottom.get() -
      rowsBelowStrip.get() -
      strip.get() * COMPOSER_STRIP_HEIGHT;
    const step = COMPOSER.thumbSize + COMPOSER.thumbGap;
    const lastVisible =
      screenWidth - GUTTER - COMPOSER.cardPadding - COMPOSER.thumbSize;
    const toX = Math.min(
      GUTTER + COMPOSER.cardPadding + flight.slot * step,
      lastVisible
    );
    const toY = stripTop + COMPOSER.stripPaddingTop;

    return {
      left: mix(a, flight.from.x, toX),
      top: mix(a, flight.from.y, toY),
      width: mix(a, flight.from.w, COMPOSER.thumbSize),
      height: mix(a, flight.from.h, COMPOSER.thumbSize),
      borderRadius: mix(
        a,
        flight.fromRadius ?? GRID.cellRadius,
        COMPOSER.thumbRadius
      ),
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.photo, style]}>
      <Image
        source={flight.photo.uri}
        recyclingKey={flight.photo.id}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
        transition={0}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

interface Props extends Omit<FlyingPhotoProps, 'flight'> {
  flights: Flight[];
}

const AttachmentFlight = ({ flights, ...drivers }: Props) => {
  if (!flights.length) return null;

  return (
    <>
      {flights.map((flight) => (
        <FlyingPhoto key={flight.photo.id} flight={flight} {...drivers} />
      ))}
    </>
  );
};

export default AttachmentFlight;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    photo: {
      position: 'absolute',
      overflow: 'hidden',
      borderCurve: 'continuous',
      backgroundColor: panelPalette(theme).photoFill,
    },
  });
