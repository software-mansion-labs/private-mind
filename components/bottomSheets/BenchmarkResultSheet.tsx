import React, { type RefObject, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, ScrollView, View } from 'react-native';
import { AppBottomSheet, type AppBottomSheetRef } from './AppBottomSheet';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import type { BenchmarkResult } from '../../database/benchmarkRepository';
import type { Model } from '../../database/modelRepository';
import DeviceInfo from 'react-native-device-info';
import SecondaryButton from '../SecondaryButton';
import ModelCard from '../model-hub/ModelCard';
import BenchmarkStatsCard from '../benchmark/BenchmarkStatsCard';
import DeviceInfoCard from '../benchmark/DeviceInfoCard';
import BenchmarkDateCard from '../benchmark/BenchmarkDateCard';
import { Feedback } from '../../utils/Feedback';

export type BenchmarkResultData = BenchmarkResult & { model?: Model };

interface Props {
  bottomSheetModalRef: RefObject<AppBottomSheetRef<BenchmarkResultData> | null>;
  handleDelete: (benchmarkId: number) => Promise<void>;
}

const BenchmarkResultSheet = ({ bottomSheetModalRef, handleDelete }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
    <AppBottomSheet<BenchmarkResultData>
      ref={bottomSheetModalRef}
      snapPoints={['50%', '90%']}
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
      }}
    >
      {({ data }) =>
        data ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
          >
            <Text style={styles.header}>Benchmark results</Text>
            <ModelCard model={data.model as Model} onPress={() => {}} />
            <BenchmarkStatsCard data={data} />
            <DeviceInfoCard deviceInfo={deviceInfo} />
            <BenchmarkDateCard timestamp={data.timestamp} />
            <SecondaryButton
              text="Delete this benchmark"
              style={styles.deleteButton}
              textStyle={styles.deleteText}
              onPress={async () => {
                await handleDelete(data.id);
                bottomSheetModalRef.current?.dismiss();
              }}
            />
            <View style={styles.bottomSpacer} />
          </ScrollView>
        ) : null
      }
    </AppBottomSheet>
  );
};

export default BenchmarkResultSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      gap: 24,
      paddingTop: 24,
      paddingHorizontal: 16,
    },
    bottomSpacer: {
      height: theme.insets.bottom + 32,
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
