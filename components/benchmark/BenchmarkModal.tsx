import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import ModelCard from '../model-hub/ModelCard';
import SecondaryButton from '../SecondaryButton';
import { SpinningCircleTimer } from '../SpinningCircleTimer';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
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
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        {!showSuccess ? (
          <View style={styles.benchmarkCard}>
            <SpinningCircleTimer size={100} time={timer} />
            <View style={styles.textWrapper}>
              <Text style={styles.statusText}>Running a benchmark</Text>
              <Text style={styles.subText}>
                It may take around 1–3 minutes…
              </Text>
            </View>
            <View style={styles.bottomSection}>
              <ModelCard model={selectedModel} onPress={() => {}} />
              <SecondaryButton text="Cancel benchmark" onPress={handleCancel} />
            </View>
          </View>
        ) : (
          <View style={styles.benchmarkCardSuccess}>
            <View style={styles.successIcon}>
              <CheckIcon
                width={48}
                height={48}
                style={styles.successIconCheck}
              />
            </View>
            <Text style={styles.statusText}>Your benchmark is ready!</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.overlay,
    },
    benchmarkCard: {
      width: '90%',
      height: 368,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: theme.bg.softPrimary,
      alignItems: 'center',
      gap: 24,
    },
    benchmarkCardSuccess: {
      width: '90%',
      height: 368,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 24,
    },
    statusText: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    subText: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
    },
    textWrapper: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    bottomSection: {
      width: '100%',
      gap: 8,
    },
    successIcon: {
      width: 100,
      height: 100,
      borderRadius: 9999,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
    },
    successIconCheck: {
      color: theme.text.contrastPrimary,
    },
  });
