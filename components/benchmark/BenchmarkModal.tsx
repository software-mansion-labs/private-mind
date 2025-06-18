import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import ModelCard from '../model-hub/ModelCard';
import SecondaryButton from '../SecondaryButton';
import { SpinningCircleTimer } from '../SpinningCircleTimer';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import { Model } from '../../database/modelRepository';
import CheckIcon from '../../assets/icons/check.svg';

interface Props {
  isVisible: boolean;
  handleCancel: () => void;
  showSuccess: boolean;
  timer: number;
  selectedModel: Model;
}

export const BenchmarkModal = ({
  isVisible,
  handleCancel,
  showSuccess,
  timer,
  selectedModel,
}: Props) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View
        style={{ ...styles.modalOverlay, backgroundColor: theme.bg.overlay }}
      >
        {!showSuccess ? (
          <View
            style={{
              ...styles.benchmarkCard,
              backgroundColor: theme.bg.softPrimary,
              height: 368,
            }}
          >
            <SpinningCircleTimer size={100} time={timer} />
            <View
              style={{
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ ...styles.statusText, color: theme.text.primary }}>
                Running a benchmark
              </Text>
              <Text
                style={{
                  ...styles.subText,
                  color: theme.text.defaultTertiary,
                }}
              >
                It may take around 1–3 minutes…
              </Text>
            </View>
            <View style={{ width: '100%', gap: 8 }}>
              <ModelCard model={selectedModel!} onPress={() => {}} />
              <SecondaryButton
                text={'Cancel benchmark'}
                onPress={handleCancel}
              />
            </View>
          </View>
        ) : (
          <View
            style={{
              ...styles.benchmarkCard,
              backgroundColor: theme.bg.softPrimary,
              alignItems: 'center',
              justifyContent: 'center',
              height: 368,
            }}
          >
            <View
              style={{
                ...styles.successIcon,
                backgroundColor: theme.bg.main,
              }}
            >
              <CheckIcon
                width={48}
                height={48}
                style={{ color: theme.text.primary }}
              />
            </View>
            <Text style={{ ...styles.statusText, color: theme.text.primary }}>
              Your benchmark is ready!
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  benchmarkCard: {
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    width: '90%',
  },
  timerText: { fontFamily: fontFamily.medium, fontSize: fontSizes.xl },
  statusText: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  subText: { fontSize: fontSizes.xs, fontFamily: fontFamily.regular },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#293775',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  successCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
