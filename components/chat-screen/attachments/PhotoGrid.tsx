import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BOTTOM_BAR, GRID, PANEL_CONTENT, type Frame } from './constants';
import SheetPlaceholder from './SheetPlaceholder';
import PhotoCell, { slotSize } from './PhotoCell';
import type { LibraryPhoto, LibraryStatus } from './usePhotoLibrary';

interface Props {
  width: number;
  height: number;
  photos: LibraryPhoto[];
  status: LibraryStatus;
  /** Ids in tap order — the index inside drives the badge number. */
  selected: string[];
  /** True once the selected photos have left for the composer. */
  lifting: boolean;
  onTogglePhoto: (photo: LibraryPhoto) => void;
}

export interface PhotoGridHandle {
  /** Where a photo is sitting right now, in the grid's own coordinates, or
   *  null if the list has not laid that index out yet. */
  measureCell: (id: string) => Frame | null;
}

/**
 * Everything the panel shows once it has become the grid. Laid out at its full
 * on-screen size and then left alone: the panel scales this whole subtree
 * during the morph, so nothing in here has to know a transition is happening.
 */
const PhotoGrid = forwardRef<PhotoGridHandle, Props>(
  function PhotoGridComponent(
    { width, height, photos, status, selected, lifting, onTogglePhoto },
    handle
  ) {
    const slot = slotSize(width);
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
          // `getLayout` is in content coordinates; the scroll offset carries the
          // list's own leading inset, so the inset has to go back in.
          const scrolled =
            list.getAbsoluteLastScrollOffset() - list.getFirstItemOffset();
          return {
            x: layout.x,
            y: layout.y - scrolled,
            // The hairline on the right and bottom is the panel showing through,
            // not part of the photo.
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
            // The keyboard is up the whole time this grid is on screen. Without
            // these the first tap is swallowed as "dismiss the keyboard".
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            ListFooterComponent={<View style={styles.footer} />}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <SheetPlaceholder>
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

const styles = StyleSheet.create({
  root: {
    // Deliberately no background: the panel's material shows through the gaps.
    ...PANEL_CONTENT,
  },
  /** Lets the last row scroll clear of the floating bar. */
  footer: {
    height: BOTTOM_BAR.inset + BOTTOM_BAR.pillHeight + 24,
  },
});
