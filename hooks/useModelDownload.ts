import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Model } from '../database/modelRepository';
import { ModelState, useModelStore } from '../store/modelStore';
import { WarningSheetData } from '../components/bottomSheets/WarningSheet';
import { Feedback } from '../utils/Feedback';

export type WifiWarningSheetRef =
  React.RefObject<BottomSheetModal<WarningSheetData> | null>;

export const useModelDownload = (
  model: Model,
  wifiWarningSheetRef?: WifiWarningSheetRef
) => {
  const tracked = useModelStore((state) => state.downloadStates[model.id]);
  const downloadModel = useModelStore((state) => state.downloadModel);
  const cancelDownload = useModelStore((state) => state.cancelDownload);

  const status =
    tracked?.status ??
    (model.isDownloaded ? ModelState.Downloaded : ModelState.NotStarted);
  const progress = tracked?.progress ?? (model.isDownloaded ? 1 : 0);

  const startDownload = async () => {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Model cannot be downloaded without internet connection.',
      });
      return;
    }

    if (networkState.type !== 'wifi' && wifiWarningSheetRef?.current) {
      wifiWarningSheetRef.current.present({
        title: 'No WiFi Connection Detected.',
        subtitle:
          'Downloading models will use your mobile data, which may incur additional charges from your carrier. We recommend connecting to WiFi for the best experience.',
        buttonTitle: 'Download anyway',
        onConfirm: async () => {
          Feedback.downloadStart();
          await downloadModel(model);
        },
      });
      return;
    }

    Feedback.downloadStart();
    await downloadModel(model);
  };

  const stopDownload = async () => {
    Feedback.cancelDownload();
    await cancelDownload(model);
  };

  return {
    status,
    progress,
    rate: tracked?.rate,
    startDownload,
    stopDownload,
  };
};
