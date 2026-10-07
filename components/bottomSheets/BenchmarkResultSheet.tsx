import React, { RefObject, useEffect, useState } from 'react';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { StyleSheet, Text } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import SheetBackdrop from './SheetBackdrop';
import { createSheetStyles } from './sheetStyles';
import DeviceInfo from 'react-native-device-info';
import SecondaryButton from '../SecondaryButton';
import ModelCard from '../model-hub/ModelCard';
import BenchmarkStatsCard from '../benchmark/BenchmarkStatsCard';
import DeviceInfoCard from '../benchmark/DeviceInfoCard';
import BenchmarkDateCard from '../benchmark/BenchmarkDateCard';
import { Feedback } from '../../utils/Feedback';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { Model } from '../../database/modelRepository';

export interface BenchmarkResultSheetData extends BenchmarkResult {
  model?: Model;
}

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<BenchmarkResultSheetData> | null>;
  handleDelete: (benchmarkId: number) => Promise<void>;
}

const BenchmarkResultSheet = ({ bottomSheetModalRef, handleDelete }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const { styles: sheet } = useThemedStyles(createSheetStyles);

  const [deviceInfo, setDeviceInfo] = useState({
    model: '',
    systemVersion: '',
    memory: '',
  });

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      const model = await DeviceInfo.getModel();
      const systemVersion = await DeviceInfo.getSystemVersion();
      const memoryInGB =
        (await DeviceInfo.getTotalMemory()) / 1024 / 1024 / 1024;
      setDeviceInfo({
        model,
        systemVersion,
        memory: `${memoryInGB.toFixed(1)} GB`,
      });
    };
    fetchDeviceInfo();
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={SheetBackdrop}
      snapPoints={['50%', '90%']}
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
      }}
      handleStyle={sheet.handle}
      handleIndicatorStyle={sheet.handleIndicator}
      backgroundStyle={sheet.background}
    >
      {({ data }) => {
        if (!data) return null;

        const onDeletePress = async () => {
          await handleDelete(data.id);
          bottomSheetModalRef.current?.dismiss();
        };

        return (
          <BottomSheetScrollView
            contentContainerStyle={styles.contentContainer}
          >
            <Text style={styles.header}>Benchmark results</Text>
            {data.model && <ModelCard model={data.model} onPress={() => {}} />}
            <BenchmarkStatsCard data={data} />
            <DeviceInfoCard deviceInfo={deviceInfo} />
            <BenchmarkDateCard timestamp={data.timestamp} />
            <SecondaryButton
              text="Delete this benchmark"
              style={styles.deleteButton}
              textStyle={styles.deleteText}
              onPress={onDeletePress}
            />
          </BottomSheetScrollView>
        );
      }}
    </BottomSheetModal>
  );
};

export default BenchmarkResultSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    contentContainer: {
      gap: 24,
      paddingVertical: 24,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    header: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    deleteButton: {
      borderColor: theme.text.error,
    },
    deleteText: {
      color: theme.text.error,
    },
  });
