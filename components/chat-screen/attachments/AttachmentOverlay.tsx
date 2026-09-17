import type { CameraType, FlashMode } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { Feedback } from '../../../utils/Feedback';
import AttachmentFlight, { type Flight } from './AttachmentFlight';
import AttachmentMenu, { type MenuAction } from './AttachmentMenu';
import AttachmentPanel from './AttachmentPanel';
import CameraBar from './CameraBar';
import CameraSheet, { type CameraSheetHandle } from './CameraSheet';
import PhotoGrid, { type PhotoGridHandle } from './PhotoGrid';
import PhotoGridBar from './PhotoGridBar';
import { BOTTOM_BAR, DURATION, GRID, GUTTER, panelPalette } from './constants';
import type { useAttachmentPanel } from './useAttachmentPanel';
import { usePhotoLibrary, type LibraryPhoto } from './usePhotoLibrary';

interface Props {
  panel: ReturnType<typeof useAttachmentPanel>;
  width: number;
  gridWidth: number;
  gridHeight: number;
  onWindowHeight?: (height: number) => void;
  busyAction?: MenuAction | null;
  menuMaxBottom: number;
  sheetTop: number;
  sheetBottom: number;
  composerBottom: SharedValue<number>;
  rowsBelowStrip: SharedValue<number>;
  strip: SharedValue<number>;
  attach: SharedValue<number>;
  flights: Flight[];
  isFlying: boolean;
  attachAndLeave: (leaving: Flight[]) => void;
  attachedIds: string[];
  maxSelection: number;
  imagesEnabled: boolean;
}

const AttachmentOverlay = ({
  panel,
  width,
  gridWidth,
  gridHeight,
  menuMaxBottom,
  onWindowHeight,
  busyAction,
  sheetTop,
  sheetBottom,
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
  const { styles } = useThemedStyles(createStyles);
  const barTop = sheetBottom - BOTTOM_BAR.inset - BOTTOM_BAR.controlSize;
  const gridRef = useRef<PhotoGridHandle>(null);
  const cameraRef = useRef<CameraSheetHandle>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const capturing = useRef(false);

  const [photosOpened, setPhotosOpened] = useState(false);
  useEffect(() => {
    if (panel.mode === 'photos') setPhotosOpened(true);
  }, [panel.mode]);
  const [panelOpened, setPanelOpened] = useState(false);
  useEffect(() => {
    if (panel.mode !== 'closed') setPanelOpened(true);
  }, [panel.mode]);
  const { photos, status } = usePhotoLibrary(panelOpened, photosOpened);

  const [enteredSheet, setEnteredSheet] = useState(false);
  useEffect(() => {
    if (panel.mode === 'photos' || panel.mode === 'camera')
      setEnteredSheet(true);
    else if (panel.mode === 'closed') setEnteredSheet(false);
  }, [panel.mode]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: panel.open.get() }));

  const togglePhoto = useCallback(
    (photo: LibraryPhoto) => {
      Feedback.toggleOn();
      setSelected((prev) => {
        if (prev.includes(photo.id)) {
          return prev.filter((id) => id !== photo.id);
        }
        return [...prev, photo.id].slice(-maxSelection);
      });
    },
    [maxSelection]
  );

  const confirmSelection = useCallback(() => {
    const picked = selected
      .map((id) => photos.find((photo) => photo.id === id))
      .filter((photo): photo is LibraryPhoto => !!photo)
      .filter((photo) => !attachedIds.includes(photo.id));
    if (!picked.length) return;
    Feedback.attach();

    const gridTop = sheetTop;
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
    gridHeight,
    gridWidth,
    photos,
    selected,
    sheetTop,
  ]);

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
  }, [attachAndLeave, gridHeight, gridWidth, sheetTop]);

  const flipCamera = useCallback(() => {
    Feedback.toggleOn();
    setFacing((was) => (was === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    Feedback.toggleOn();
    setFlash((was) => (was === 'off' ? 'on' : 'off'));
  }, []);

  const clearSelection = useCallback(() => setSelected([]), []);
  const barLeftAt = useRef(0);
  const previousMode = useRef(panel.mode);
  if (previousMode.current !== panel.mode) {
    const was = previousMode.current;
    previousMode.current = panel.mode;
    if (was === 'photos' || was === 'camera') barLeftAt.current = Date.now();
    if (panel.mode !== 'photos' && selected.length) clearSelection();
  }

  const [resumeKey, setResumeKey] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || panel.mode === 'closed') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setResumeKey((key) => key + 1);
    });
    return () => subscription.remove();
  }, [panel.mode]);

  const dismissFromBackdrop = useCallback(() => {
    if (Date.now() - barLeftAt.current < DURATION.crossfade) return;
    panel.dismiss();
  }, [panel]);

  return (
    <OverKeyboardView visible={panel.mode !== 'closed'}>
      {panel.mode !== 'closed' ? (
        <View
          key={resumeKey}
          pointerEvents={isFlying ? 'none' : 'box-none'}
          style={StyleSheet.absoluteFill}
          onLayout={(event) =>
            onWindowHeight?.(event.nativeEvent.layout.height)
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          />
          <Pressable
            accessibilityLabel="Close attachment menu"
            testID="attachment-backdrop"
            onPress={dismissFromBackdrop}
            style={StyleSheet.absoluteFill}
          />
          <AttachmentPanel
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            menuMaxBottom={menuMaxBottom}
            sheetTop={sheetTop}
            sheetHeight={gridHeight}
            interactive={
              isFlying ? 'none' : panel.mode === 'menu' ? 'menu' : 'grid'
            }
            glass={!panel.closing}
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
                busy={busyAction}
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
                  preview={
                    panel.mode === 'camera' && !panel.closing && !isFlying
                  }
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

          {/* Outside the panel on purpose: glass under the panel's animated
              opacity renders flat. */}
          {panel.sheet === 'camera' ? (
            <CameraBar
              width={gridWidth}
              top={barTop}
              active={panel.mode === 'camera' && !panel.closing && !isFlying}
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
              active={panel.mode === 'photos' && !panel.closing && !isFlying}
              fade={panel.gridOpacity}
              onBack={panel.backToMenu}
              onConfirm={confirmSelection}
            />
          )}

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      backgroundColor: panelPalette(theme).backdrop,
    },
  });

export default AttachmentOverlay;
