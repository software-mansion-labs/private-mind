import React, { RefObject, useCallback, useEffect, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import DeviceInfo from 'react-native-device-info';
import SecondaryButton from '../SecondaryButton';
import ModelCard from '../model-hub/ModelCard';
import BenchmarkStatsCard from '../benchmark/BenchmarkStatsCard';
import DeviceInfoCard from '../benchmark/DeviceInfoCard';
import BenchmarkDateCard from '../benchmark/BenchmarkDateCard';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  handleDelete: (benchmarkId: number) => Promise<void>;
}

const BenchmarkResultSheet = ({ bottomSheetModalRef, handleDelete }: Props) => {
  const { theme } = useTheme();

  const [deviceInfo, setDeviceInfo] = useState({
    model: '',
    systemVersion: '',
    memory: '',
  });

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        style={{
          backgroundColor: theme.bg.overlay,
        }}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

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
      backdropComponent={renderBackdrop}
      snapPoints={['50%', '90%']}
      handleStyle={{
        borderRadius: 16,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
      backgroundStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
    >
      {(props) => (
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={{ ...styles.header, color: theme.text.primary }}>
            Benchmark results
          </Text>
          <ModelCard model={props.data.model} onPress={() => {}} />
          <BenchmarkStatsCard data={props.data} />
          <DeviceInfoCard deviceInfo={deviceInfo} />
          <BenchmarkDateCard timestamp={props.data.timestamp} />

          {/* <SecondaryButton text="Share this benchmark" onPress={() => {}} /> */}
          <SecondaryButton
            text="Delete this benchmark"
            style={{ borderColor: theme.text.error }}
            textStyle={{ color: theme.text.error }}
            onPress={async () => {
              await handleDelete(props.data.id);
              bottomSheetModalRef.current?.dismiss();
            }}
          />
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    gap: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  header: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
});

export default BenchmarkResultSheet;
