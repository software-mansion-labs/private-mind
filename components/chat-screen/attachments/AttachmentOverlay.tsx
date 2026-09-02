import type { CameraType, FlashMode } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { Feedback } from '../../../utils/Feedback';
import AttachmentFlight, { type Flight } from './AttachmentFlight';
import AttachmentMenu from './AttachmentMenu';
import AttachmentPanel from './AttachmentPanel';
import CameraBar from './CameraBar';
import CameraSheet, { type CameraSheetHandle } from './CameraSheet';
import PhotoGrid, { type PhotoGridHandle } from './PhotoGrid';
import PhotoGridBar from './PhotoGridBar';
import { BOTTOM_BAR, DURATION, GRID, GUTTER } from './constants';
import type { useAttachmentPanel } from './useAttachmentPanel';
import { usePhotoLibrary, type LibraryPhoto } from './usePhotoLibrary';

interface Props {
  panel: ReturnType<typeof useAttachmentPanel>;
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  /** How low the menu shape may be drawn — see `useSheetGeometry`. */
  menuMaxBottom: number;
  /** Window Y of the sheet's top edge — one footprint for grid and camera. */
  sheetTop: number;
  composerBottom: SharedValue<number>;
  rowsBelowStrip: SharedValue<number>;
  strip: SharedValue<number>;
  attach: SharedValue<number>;
  flights: Flight[];
  isFlying: boolean;
  attachAndLeave: (leaving: Flight[]) => void;
  /** Ids already in the composer — a duplicate id breaks the strip's keys. */
  attachedIds: string[];
  /** How many photos may be picked at once. One, while the send path is
   *  single-image. */
  maxSelection: number;
  imagesEnabled: boolean;
}

/**
 * Everything that lives over the keyboard while the panel is up: the dismiss
 * backdrop, the morphing panel, the sheet's floating controls and the photos
 * crossing to the composer. Assembled here rather than in `ChatBar` so the bar
 * keeps only what it draws itself — the + glyph and the strip.
 */
const AttachmentOverlay = ({
  panel,
  width,
  height,
  gridWidth,
  gridHeight,
  menuMaxBottom,
  sheetTop,
  composerBottom,
  rowsBelowStrip,
  strip,
  attach,
  flights,
  isFlying,
  attachAndLeave,
  attachedIds,
  maxSelection,
  imagesEnabled,
}: Props) => {
  /** The bar rides the sheet's bottom edge, computed the same way the panel
   *  computes its own — see `SheetBar`. */
  const barTop = height - GUTTER - BOTTOM_BAR.inset - BOTTOM_BAR.controlSize;
  const gridRef = useRef<PhotoGridHandle>(null);
  const cameraRef = useRef<CameraSheetHandle>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  /** True from the shutter tap until the capture is in hand — one at a time. */
  const capturing = useRef(false);

  /**
   * The library is read the first time the photo sheet is actually opened, and
   * stays warm after that. This hook lives at the overlay's level, which is
   * mounted for the whole life of the composer — gating on `sheet` alone would
   * ask a privacy-first app's user for their photo library on launch, since
   * `photos` is the sheet the panel defaults to.
   */
  const [photosOpened, setPhotosOpened] = useState(false);
  useEffect(() => {
    if (panel.mode === 'photos') setPhotosOpened(true);
  }, [panel.mode]);
  const { photos, status } = usePhotoLibrary(photosOpened);

  /**
   * Whether this visit to the panel has been inside a sheet yet.
   *
   * The panel keeps both of its layers mounted so the morph can crossfade
   * between them, but the sheet's *contents* have no business existing while
   * the menu is up: profiling the + tap showed FlashList, 24 photo cells and 36
   * images mounting under a menu nobody had left yet — about 100ms of React
   * work landing on the frames the panel is trying to open in. It stays mounted
   * once entered, so `‹` back to the menu still crossfades, and goes when the
   * panel does.
   */
  const [enteredSheet, setEnteredSheet] = useState(false);
  useEffect(() => {
    if (panel.mode === 'photos' || panel.mode === 'camera')
      setEnteredSheet(true);
    else if (panel.mode === 'closed') setEnteredSheet(false);
  }, [panel.mode]);

  const togglePhoto = useCallback(
    (photo: LibraryPhoto) => {
      Feedback.toggleOn();
      setSelected((prev) => {
        if (prev.includes(photo.id)) {
          return prev.filter((id) => id !== photo.id);
        }
        // At a cap of one this reads as "pick a different photo" rather than
        // "you cannot pick that", which is what a single-image send path wants.
        return [...prev, photo.id].slice(-maxSelection);
      });
    },
    [maxSelection]
  );

  const confirmSelection = useCallback(() => {
    const picked = selected
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is LibraryPhoto => !!photo)
      // The grid does not know what is already in the composer, and an id is
      // the strip's React key — two rows under one key breaks their layout
      // animations.
      .filter((photo) => !attachedIds.includes(photo.id));
    if (!picked.length) return;
    Feedback.attach();

    // Where each photo is sitting on the frame it leaves. The panel is at rest
    // and fully morphed here, so its own frame is the offset from the window —
    // no measure pass, and nothing that can land a frame late.
    const gridTop = sheetTop;
    // Only used for a photo the list has not laid out. The middle of the sheet
    // is the least wrong answer: it is where the sheet is collapsing towards.
    const cellSize = gridWidth / GRID.columns - GRID.gap;
    const fallback = {
      x: GUTTER + (gridWidth - cellSize) / 2,
      y: gridTop + (gridHeight - cellSize) / 2,
      w: cellSize,
      h: cellSize,
    };

    attachAndLeave(
      picked.map((photo, index) => {
        const cell = gridRef.current?.measureCell(photo.id);
        return {
          photo,
          slot: index,
          from: cell
            ? { x: GUTTER + cell.x, y: gridTop + cell.y, w: cell.w, h: cell.h }
            : fallback,
        };
      })
    );
  }, [
    attachAndLeave,
    attachedIds,
    composerBottom,
    gridHeight,
    gridWidth,
    photos,
    selected,
  ]);

  /**
   * The shutter. The picture leaves as the whole sheet — the preview's rect,
   * with the sheet's own corners — and the preview underneath is cut on the
   * frame the copy appears.
   */
  const capturePhoto = useCallback(async () => {
    if (capturing.current) return;
    capturing.current = true;
    try {
      const uri = await cameraRef.current?.takePicture();
      if (!uri) return;
      Feedback.attach();

      attachAndLeave([
        {
          photo: { id: uri, uri },
          slot: 0,
          from: { x: GUTTER, y: sheetTop, w: gridWidth, h: gridHeight },
          fromRadius: GRID.panelRadius,
        },
      ]);
    } finally {
      capturing.current = false;
    }
  }, [attachAndLeave, composerBottom, gridHeight, gridWidth]);

  const flipCamera = useCallback(() => {
    Feedback.toggleOn();
    setFacing((was) => (was === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    Feedback.toggleOn();
    setFlash((was) => (was === 'off' ? 'on' : 'off'));
  }, []);

  // The panel drops the selection on its way out of a sheet; this is the other
  // half of that, kept here because the selection is the overlay's own state.
  const clearSelection = useCallback(() => setSelected([]), []);
  const previousMode = useRef(panel.mode);
  if (previousMode.current !== panel.mode) {
    previousMode.current = panel.mode;
    if (panel.mode !== 'photos' && selected.length) clearSelection();
  }

  return (
    // The sheet overlaps the keyboard by design, so it is hosted in the window
    // above it.
    <OverKeyboardView visible={panel.mode !== 'closed'}>
      {panel.mode !== 'closed' ? (
        // Nothing takes a touch once the photos are on their way: the sheet is
        // leaving, and a backdrop tap would start a second close on top of it.
        <View
          pointerEvents={isFlying ? 'none' : 'box-none'}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityLabel="Close attachment menu"
            testID="attachment-backdrop"
            onPress={panel.dismiss}
            style={StyleSheet.absoluteFill}
          />
          <AttachmentPanel
            screenHeight={height}
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            menuMaxBottom={menuMaxBottom}
            sheetTop={sheetTop}
            interactive={
              isFlying ? 'none' : panel.mode === 'menu' ? 'menu' : 'grid'
            }
            // The material is the panel's, not the menu's: it stays on through
            // the morph and goes only once the sheet is on its way out.
            glass={!panel.closing}
            glassDuration={DURATION.panel / 1000}
            open={panel.open}
            morph={panel.morph}
            menuOpacity={panel.menuOpacity}
            gridOpacity={panel.gridOpacity}
            blur={panel.blur}
            composerBottom={composerBottom}
            menu={
              <AttachmentMenu
                onSelect={panel.onMenuAction}
                imagesEnabled={imagesEnabled}
              />
            }
            grid={
              !enteredSheet ? null : panel.sheet === 'camera' ? (
                <CameraSheet
                  ref={cameraRef}
                  width={gridWidth}
                  height={gridHeight}
                  facing={facing}
                  flash={flash}
                  lifting={isFlying}
                />
              ) : (
                <PhotoGrid
                  ref={gridRef}
                  width={gridWidth}
                  height={gridHeight}
                  photos={photos}
                  status={status}
                  selected={selected}
                  lifting={isFlying}
                  onTogglePhoto={togglePhoto}
                />
              )
            }
          />

          {/* The floating controls live beside the panel, not inside it: glass
              under the panel's animated layers comes out flat. */}
          {panel.sheet === 'camera' ? (
            <CameraBar
              width={gridWidth}
              top={barTop}
              active={panel.mode === 'camera' && !isFlying}
              fade={panel.gridOpacity}
              flash={flash}
              onBack={panel.backToMenu}
              onCapture={capturePhoto}
              onFlip={flipCamera}
              onToggleFlash={toggleFlash}
            />
          ) : (
            <PhotoGridBar
              width={gridWidth}
              top={barTop}
              selected={selected}
              active={panel.mode === 'photos' && !isFlying}
              fade={panel.gridOpacity}
              onBack={panel.backToMenu}
              onConfirm={confirmSelection}
            />
          )}

          {/* Above the sheet and outside its clip: the photos have left it, and
              the last stretch is over the composer. */}
          <AttachmentFlight
            flights={flights}
            screenWidth={width}
            attach={attach}
            strip={strip}
            composerBottom={composerBottom}
            rowsBelowStrip={rowsBelowStrip}
          />
        </View>
      ) : null}
    </OverKeyboardView>
  );
};

export default AttachmentOverlay;
