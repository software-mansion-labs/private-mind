import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BOTTOM_BAR,
  GRID,
  PANEL_CONTENT,
  panelPalette,
  type Frame,
} from './constants';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { openAppSettings } from '../../../utils/openAppSettings';
import SheetPlaceholder from './SheetPlaceholder';
import PhotoCell, { slotSize } from './PhotoCell';
import type { LibraryPhoto, LibraryStatus } from './usePhotoLibrary';

interface Props {
  width: number;
  height: number;
  photos: LibraryPhoto[];
  status: LibraryStatus;
  selected: string[];
  lifting: boolean;
  onTogglePhoto: (photo: LibraryPhoto) => void;
}

export interface PhotoGridHandle {
  measureCell: (id: string) => Frame | null;
}

const PhotoGrid = forwardRef<PhotoGridHandle, Props>(
  function PhotoGridComponent(
    { width, height, photos, status, selected, lifting, onTogglePhoto },
    handle
  ) {
    const { styles } = useThemedStyles(createStyles);
    // A gap wider and taller than the sheet, clipped by the root: the trailing
    // gap of the last column and row falls outside instead of showing ground.
    const listWidth = width + GRID.gap;
    const slot = slotSize(listWidth);
    const listRef = useRef<FlashListRef<LibraryPhoto>>(null);

    useImperativeHandle(
      handle,
      () => ({
        measureCell: (id) => {
          const list = listRef.current;
          const index = photos.findIndex((photo) => photo.id === id);
          if (!list || index < 0) return null;
          const layout = list.getLayout(index);
          if (!layout) return null;
          const scrolled =
            list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
          return {
            x: layout.x,
            y: layout.y - scrolled,
            w: layout.width - GRID.gap,
            h: layout.height - GRID.gap,
          };
        },
      }),
      [photos]
    );

    return (
      <View style={[styles.root, { width, height }]}>
        {status === 'ready' ? (
          <FlashList
            style={{ width: listWidth, height: height + GRID.gap }}
            ref={listRef}
            data={photos}
            numColumns={GRID.columns}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PhotoCell
                photo={item}
                slot={slot}
                order={selected.indexOf(item.id) + 1}
                lifted={lifting && selected.includes(item.id)}
                onPress={onTogglePhoto}
              />
            )}
            extraData={`${selected.join()}|${lifting}`}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            ListFooterComponent={<View style={styles.footer} />}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <SheetPlaceholder
            onOpenSettings={status === 'denied' ? openAppSettings : undefined}
          >
            {status === 'loading'
              ? 'Loading photos…'
              : status === 'empty'
                ? 'No photos on this device.'
                : 'Photo access is off. Turn it on in Settings to pick photos here.'}
          </SheetPlaceholder>
        )}
      </View>
    );
  }
);

export default PhotoGrid;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      ...PANEL_CONTENT,
      backgroundColor: panelPalette(theme).photoFill,
      overflow: 'hidden',
    },
    footer: {
      height: BOTTOM_BAR.inset + BOTTOM_BAR.pillHeight + 24,
    },
  });
