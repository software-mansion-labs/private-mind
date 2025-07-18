import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [deviceInfo, setDeviceInfo] = useState({
    model: '',
    systemVersion: '',
    memory: '',
  });

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
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
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      {(props) => (
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={styles.header}>Benchmark results</Text>
          <ModelCard model={props.data.model} onPress={() => {}} />
          <BenchmarkStatsCard data={props.data} />
          <DeviceInfoCard deviceInfo={deviceInfo} />
          <BenchmarkDateCard timestamp={props.data.timestamp} />
          <SecondaryButton
            text="Delete this benchmark"
            style={styles.deleteButton}
            textStyle={styles.deleteText}
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

export default BenchmarkResultSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    contentContainer: {
      gap: 24,
      paddingVertical: 16,
      paddingHorizontal: 24,
    },
    header: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    handleStyle: {
      borderRadius: 16,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    sheetBackground: {
      backgroundColor: theme.bg.softPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    deleteButton: {
      borderColor: theme.text.error,
    },
    deleteText: {
      color: theme.text.error,
    },
  });
