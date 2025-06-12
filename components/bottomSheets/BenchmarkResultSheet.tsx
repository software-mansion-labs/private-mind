import React, { RefObject, useCallback, useEffect, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import ModelCard from '../model-hub/ModelCard';
import DeviceInfo from 'react-native-device-info';
import SecondaryButton from '../SecondaryButton';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const Divider = () => <View style={styles.divider} />;

const BenchmarkResultSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const [deviceInfo, setDeviceInfo] = useState({
    model: '',
    systemVersion: '',
    arch: [],
    memory: '',
    cores: 0,
  });

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.2}
      />
    ),
    []
  );

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      const model = await DeviceInfo.getModel();
      const systemVersion = await DeviceInfo.getSystemVersion();
      const arch = await DeviceInfo.supportedAbis();
      const memory = `${
        (await DeviceInfo.getTotalMemory()) / 1024 / 1024 / 1024
      } GB`;
      const cores = 6;

      setDeviceInfo({
        model,
        systemVersion,
        arch,
        memory,
        cores,
      });
    };

    fetchDeviceInfo();
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={true}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
    >
      {(props) => {
        return (
          <BottomSheetView style={styles.bottomSheet}>
            <ScrollView contentContainerStyle={styles.contentContainer}>
              <Text style={styles.header}>Benchmark results</Text>

              <ModelCard model={props.data.model} onPress={() => {}} />

              <View style={{ ...styles.card, borderColor: theme.border.soft }}>
                <View style={styles.data}>
                  <Text
                    style={{
                      ...styles.label,
                      color: theme.text.defaultSecondary,
                    }}
                  >
                    Total Time
                  </Text>
                  <Text
                    style={{
                      ...styles.result,
                      color: theme.text.primary,
                    }}
                  >
                    {(props.data.totalTime / 1000).toFixed(2)} s
                  </Text>
                </View>
                <Divider />
                <View style={styles.row}>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Time to First Token
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {props.data.timeToFirstToken.toFixed(2)} ms
                    </Text>
                  </View>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Tokens Generated
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {props.data.tokensGenerated.toFixed()}
                    </Text>
                  </View>
                </View>
                <Divider />
                <View style={styles.row}>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Tokens Per Second
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {props.data.tokensPerSecond.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Peak Memory
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {props.data.peakMemory.toFixed(2)} GB
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ ...styles.card, borderColor: theme.border.soft }}>
                <View style={styles.data}>
                  <Text
                    style={{
                      ...styles.label,
                      color: theme.text.defaultSecondary,
                    }}
                  >
                    Device Used
                  </Text>
                  <Text
                    style={{
                      ...styles.result,
                      color: theme.text.primary,
                    }}
                  >
                    {deviceInfo.model}
                  </Text>
                </View>
                <Divider />
                <View style={styles.row}>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      System Version
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {deviceInfo.systemVersion}
                    </Text>
                  </View>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Architecture
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {deviceInfo.arch[0]}
                    </Text>
                  </View>
                </View>
                <Divider />
                <View style={styles.row}>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      CPU Cores
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {deviceInfo.cores}
                    </Text>
                  </View>
                  <View style={styles.data}>
                    <Text
                      style={{
                        ...styles.label,
                        color: theme.text.defaultSecondary,
                      }}
                    >
                      Total Memory
                    </Text>
                    <Text
                      style={{
                        ...styles.result,
                        color: theme.text.primary,
                      }}
                    >
                      {deviceInfo.memory}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ ...styles.card, borderColor: theme.border.soft }}>
                <Text
                  style={{
                    ...styles.label,
                    color: theme.text.defaultSecondary,
                  }}
                >
                  Benchmark date
                </Text>
                <Text
                  style={{
                    ...styles.result,
                    color: theme.text.primary,
                  }}
                >
                  {new Date(props.data.timestamp).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <SecondaryButton text="Share this benchmark" onPress={() => {}} />
            </ScrollView>
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
  contentContainer: {
    gap: 16,
  },
  header: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
    color: '#1E2A4B',
  },
  card: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    flexDirection: 'column',
    gap: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  data: {
    gap: 4,
    width: '40%',
  },
  result: { fontFamily: fontFamily.medium, fontSize: fontSizes.md },
  label: { fontFamily: fontFamily.regular, fontSize: fontSizes.sm },
});

export default BenchmarkResultSheet;
