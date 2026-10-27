import React, { RefObject, useEffect, useState } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, textStyles } from '../../constants/design-system';
import DeviceInfo from 'react-native-device-info';
import BenchmarkStatsCard from '../benchmark/BenchmarkStatsCard';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import PhoneIcon from '../../assets/icons/phone.svg';
import { Feedback } from '../../utils/Feedback';
import { getModelFamily } from '../../utils/modelFamily';
import { formatBenchmarkDate } from '../../utils/formatBenchmarkDate';
import { BenchmarkResult } from '../../database/benchmarkRepository';
import { Model } from '../../database/modelRepository';

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DEVICE_ICON_SIZE = 14;
const DELETE_BUTTON_HEIGHT = 44;

export interface BenchmarkResultSheetData extends BenchmarkResult {
  model?: Model;
}

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<BenchmarkResultSheetData> | null>;
  handleDelete: (benchmarkId: number) => Promise<void>;
}

interface DeviceDetails {
  model: string;
  systemName: string;
  systemVersion: string;
  memory: string;
}

const BenchmarkResultSheet = ({ bottomSheetModalRef, handleDelete }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const [deviceInfo, setDeviceInfo] = useState<DeviceDetails>({
    model: '',
    systemName: '',
    systemVersion: '',
    memory: '',
  });

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      const [model, totalMemory] = await Promise.all([
        DeviceInfo.getModel(),
        DeviceInfo.getTotalMemory(),
      ]);
      setDeviceInfo({
        model,
        systemName: DeviceInfo.getSystemName(),
        systemVersion: DeviceInfo.getSystemVersion(),
        memory: `${(totalMemory / BYTES_PER_GB).toFixed(1)} GB`,
      });
    };
    fetchDeviceInfo();
  }, []);

  const deviceLine = [
    deviceInfo.model,
    [deviceInfo.systemName, deviceInfo.systemVersion].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <BackDismissibleSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
      }}
    >
      {({ data }) => {
        if (!data) return null;

        const onDeletePress = async () => {
          await handleDelete(data.id);
          bottomSheetModalRef.current?.dismiss();
        };

        return (
          <BottomSheetView style={styles.container}>
            <Text style={styles.title}>Benchmark results</Text>
            <ModelRow>
              <ModelFamilyTile
                family={getModelFamily(
                  data.model ?? { modelName: data.modelName }
                )}
                size="list"
              />
              <ModelRowText
                title={data.modelName}
                subtitle={formatBenchmarkDate(data.timestamp)}
                subtitleTone="tertiary"
              />
            </ModelRow>
            <BenchmarkStatsCard data={data} deviceMemory={deviceInfo.memory} />
            {deviceLine.length > 0 && (
              <View style={styles.deviceRow}>
                <PhoneIcon
                  width={DEVICE_ICON_SIZE}
                  height={DEVICE_ICON_SIZE}
                  style={styles.deviceIcon}
                />
                <Text style={styles.deviceText}>{deviceLine}</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onDeletePress}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && pressedOpacity,
              ]}
              testID="benchmark-result-delete"
            >
              <Text style={styles.deleteText}>Delete result</Text>
            </Pressable>
          </BottomSheetView>
        );
      }}
    </BackDismissibleSheetModal>
  );
};

export default BenchmarkResultSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: space.four,
      paddingTop: space.two,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.two,
    },
    title: {
      ...textStyles.titleSheet,
      color: theme.text.primary,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    deviceIcon: {
      color: theme.text.defaultTertiary,
    },
    deviceText: {
      flex: 1,
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultTertiary,
    },
    deleteButton: {
      height: DELETE_BUTTON_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.twelve,
    },
    deleteText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.error,
    },
  });
