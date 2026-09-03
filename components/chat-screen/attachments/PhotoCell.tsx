import { Image } from 'expo-image';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily } from '../../../styles/fontStyles';
import { GRID, SPRING, panelPalette } from './constants';
import type { LibraryPhoto } from './usePhotoLibrary';

/** Width of one of the three columns. No gutter to remove: the sheet carries
 *  the inset and the grid runs edge to edge inside it. */
export function slotSize(width: number) {
  return width / GRID.columns;
}

interface Props {
  photo: LibraryPhoto;
  slot: number;
  /** 1-based tap order, or 0 when the photo isn't selected. */
  order: number;
  /**
   * True once this photo has left for the composer. Cut rather than faded: a
   * copy is flying out of this exact rect on the same frame.
   */
  lifted: boolean;
  onPress: (photo: LibraryPhoto) => void;
}

const PhotoCell = memo(function PhotoCellComponent({
  photo,
  slot,
  order,
  lifted,
  onPress,
}: Props) {
  const { styles } = useThemedStyles(createStyles);
  const selected = order > 0;
  // Selection is the badge and nothing else: the thumbnail does not shrink,
  // dim, or round its corners.
  const progress = useDerivedValue(() =>
    withSpring(selected ? 1 : 0, SPRING.badge)
  );

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.4, 1]) }],
  }));

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityState={{ selected }}
      testID={`photo-cell-${photo.id}`}
      onPress={() => onPress(photo)}
      style={{ width: slot, height: slot, opacity: lifted ? 0 : 1 }}
    >
      <View style={styles.cell}>
        <Image
          source={photo.uri}
          recyclingKey={photo.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Animated.View pointerEvents="none" style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeLabel}>{selected ? order : ''}</Text>
      </Animated.View>
    </Pressable>
  );
});

export default PhotoCell;

const createStyles = (theme: Theme) => {
  const palette = panelPalette(theme);
  return StyleSheet.create({
    cell: {
      position: 'absolute',
      left: 0,
      top: 0,
      // A hairline of the panel shows through on the right and bottom of every
      // cell; paired with the small radius that is what separates the photos.
      right: GRID.gap,
      bottom: GRID.gap,
      borderRadius: GRID.cellRadius,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: palette.photoFill,
    },
    badge: {
      position: 'absolute',
      right: GRID.badgeInset + GRID.gap,
      bottom: GRID.badgeInset + GRID.gap,
      width: GRID.badgeSize,
      height: GRID.badgeSize,
      borderRadius: GRID.badgeSize / 2,
      borderWidth: GRID.badgeRing,
      borderColor: theme.text.contrastPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
    },
    badgeLabel: {
      color: '#ffffff',
      fontSize: GRID.badgeLabelSize,
      fontFamily: fontFamily.bold,
      fontVariant: ['tabular-nums'],
    },
  });
};
