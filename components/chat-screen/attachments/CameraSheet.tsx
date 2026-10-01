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
import { CAMERA, GRID, PANEL_CONTENT, panelPalette } from './constants';
import { openAppSettings } from '../../../utils/openAppSettings';
import SheetPlaceholder from './SheetPlaceholder';

export interface CameraSheetHandle {
  takePicture: () => Promise<string | null>;
}

interface Props {
  width: number;
  height: number;
  facing: CameraType;
  flash: FlashMode;
  // On Android the preview is a SurfaceView that nothing in React can clip,
  // round or fade, so it is handed over only while the panel stands still.
  preview: boolean;
  lifting: boolean;
}

const CameraSheet = forwardRef<CameraSheetHandle, Props>(
  function CameraSheetComponent(
    { width, height, facing, flash, preview, lifting },
    handle
  ) {
    const { styles } = useThemedStyles(createStyles);
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const ready = useRef(false);

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
    const refused = !!permission && !permission.canAskAgain && !granted;

    return (
      <View
        style={[
          styles.root,
          !granted && styles.withoutPreview,
          { width, height },
        ]}
      >
        {!granted ? (
          <SheetPlaceholder
            onOpenSettings={refused ? openAppSettings : undefined}
          >
            {refused
              ? 'Camera access is off. Turn it on in Settings to take a photo here.'
              : 'Waiting for camera access…'}
          </SheetPlaceholder>
        ) : preview ? (
          <CameraView
            ref={cameraRef}
            facing={facing}
            flash={flash}
            mirror={facing === 'front'}
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
      backgroundColor: theme.bg.lightbox,
      borderRadius: GRID.panelRadius,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
    withoutPreview: {
      backgroundColor: panelPalette(theme).photoFill,
    },
    lifted: {
      opacity: 0,
    },
  });
