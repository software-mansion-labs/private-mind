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
  /** The cell the photo was sitting in, in window coordinates, measured on the
   *  frame the flight starts. */
  from: Frame;
  /** Index of the composer slot it is landing on. */
  slot: number;
  /** Corner radius it leaves with — a grid cell's hairline by default, the
   *  sheet's own for a camera capture. */
  fromRadius?: number;
}

interface FlyingPhotoProps {
  flight: Flight;
  screenWidth: number;
  /** 0 still in the grid → 1 landed on its slot in the composer. */
  attach: SharedValue<number>;
  /** The composer grows around the strip on its own spring, so the slot is
   *  still rising while the photo flies. Read live. */
  strip: SharedValue<number>;
  composerBottom: SharedValue<number>;
  /**
   * Height of everything below the strip inside the composer card — the text
   * row, the actions row, the gaps and the card's bottom padding. Measured
   * rather than assumed: the text row grows with what is typed.
   */
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

    // The composer's bottom edge is pinned and the strip grows it upward, so
    // the slot is found from the bottom up — and it is still rising while the
    // photo flies, which is why this reads `strip` live rather than landing on
    // a precomputed point.
    const stripTop =
      composerBottom.get() -
      rowsBelowStrip.get() -
      strip.get() * COMPOSER_STRIP_HEIGHT;
    const step = COMPOSER.thumbSize + COMPOSER.thumbGap;
    // The strip scrolls, so a slot past the right edge has nowhere to land.
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
        // Already decoded — the same image the grid is drawing, handed over on
        // the frame the cell hides. A fade would show the sheet through it.
        transition={0}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

interface Props extends Omit<FlyingPhotoProps, 'flight'> {
  flights: Flight[];
}

/**
 * The photos crossing from the grid to the composer. Copies, not the cells
 * themselves: the cells belong to a list inside a sheet that is collapsing at
 * the same time. Every copy rides the same `attach` spring — they were picked
 * together and they arrive together.
 */
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
