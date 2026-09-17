import {
  CameraView,
  useCameraPermissions,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { CAMERA, GRID, PANEL_CONTENT } from './constants';
import SheetPlaceholder from './SheetPlaceholder';

export interface CameraSheetHandle {
  /** Captures a still and resolves to its `file://` uri, or null if the camera
   *  had nothing to give. */
  takePicture: () => Promise<string | null>;
}

interface Props {
  width: number;
  height: number;
  facing: CameraType;
  flash: FlashMode;
  /**
   * Whether the preview itself is showing. On Android it is a `SurfaceView`,
   * composited straight to the screen: nothing in React can clip it, round it
   * or fade it, and only its own layout bounds decide what is seen. So there it
   * is handed over only while the panel is standing still at the sheet's rect —
   * see `AttachmentOverlay`. What is left in its place is this sheet's own
   * ground, an ordinary view that cuts to the panel like everything else.
   */
  preview: boolean;
  /** True once the picture has left for the composer. The preview is cut on
   *  that frame, not faded. */
  lifting: boolean;
}

/**
 * Everything the panel shows once it has become the camera — the same footprint
 * the photo grid takes, scaled by the panel through the morph. The controls
 * floating over it live in `CameraBar`, outside the panel: they are glass, and
 * glass under the panel's animated opacity renders as nothing.
 */
const CameraSheet = forwardRef<CameraSheetHandle, Props>(
  function CameraSheetComponent(
    { width, height, facing, flash, preview, lifting },
    handle
  ) {
    const { styles } = useThemedStyles(createStyles);
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const ready = useRef(false);

    // Asked for once the sheet is up — the preview has nothing to show without it.
    useEffect(() => {
      if (permission && !permission.granted && permission.canAskAgain) {
        requestPermission();
      }
    }, [permission, requestPermission]);

    useEffect(() => {
      if (!preview) ready.current = false;
    }, [preview]);

    useImperativeHandle(
      handle,
      () => ({
        takePicture: async () => {
          const camera = cameraRef.current;
          if (!camera || !ready.current) return null;
          try {
            const picture = await camera.takePictureAsync({
              quality: CAMERA.quality,
              shutterSound: false,
            });
            return picture?.uri ?? null;
          } catch (error) {
            console.error('Camera capture failed', error);
            return null;
          }
        },
      }),
      []
    );

    const granted = !!permission?.granted;

    return (
      <View style={[styles.root, { width, height }]}>
        {!granted ? (
          <SheetPlaceholder>
            {permission && !permission.canAskAgain
              ? 'Camera access is off. Turn it on in Settings to take a photo here.'
              : 'Waiting for camera access…'}
          </SheetPlaceholder>
        ) : preview ? (
          <CameraView
            ref={cameraRef}
            facing={facing}
            flash={flash}
            // A selfie preview reads as a mirror; the capture should match it.
            mirror={facing === 'front'}
            // The sheet carries the capture out itself — see the flight — so the
            // stock blink would be a second, unrelated thing on top.
            animateShutter={false}
            onCameraReady={() => {
              ready.current = true;
            }}
            style={[StyleSheet.absoluteFill, lifting && styles.lifted]}
          />
        ) : null}
      </View>
    );
  }
);

export default CameraSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      ...PANEL_CONTENT,
      // Black rather than the panel's material: a preview starts a frame or two
      // after it mounts, and black is what shows there.
      backgroundColor: theme.bg.lightbox,
      // The shape the panel wears once it has finished morphing, which is the
      // only one the camera is ever seen in — see `preview`.
      borderRadius: GRID.panelRadius,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
    lifted: {
      opacity: 0,
    },
  });
