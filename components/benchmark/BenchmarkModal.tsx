import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import ModelCapabilityBadges from '../model-hub/ModelCapabilityBadges';
import SecondaryButton from '../SecondaryButton';
import { SpinningCircleTimer } from '../SpinningCircleTimer';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import { radius, space, stroke } from '../../constants/design-system';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import CheckIcon from '../../assets/icons/check.svg';

interface Props {
  isVisible: boolean;
  handleCancel: () => void;
  showSuccess: boolean;
  timer: number;
  selectedModel?: Model | null;
}

export const BenchmarkModal = ({
  isVisible,
  handleCancel,
  showSuccess,
  timer,
  selectedModel,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
      navigationBarTranslucent
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
              {selectedModel && (
                <ModelRow style={styles.modelCard}>
                  <ModelFamilyTile
                    family={getModelFamily(selectedModel)}
                    size="card"
                  />
                  <ModelRowText
                    title={selectedModel.modelName}
                    titleLines={0}
                    subtitle={formatModelMeta(selectedModel, 'B')}
                    style={styles.modelText}
                  >
                    <ModelCapabilityBadges
                      model={selectedModel}
                      style={styles.modelBadges}
                    />
                  </ModelRowText>
                </ModelRow>
              )}
              <SecondaryButton text="Cancel benchmark" onPress={handleCancel} />
            </View>
          </View>
        ) : (
          <View style={styles.benchmarkCardSuccess}>
            <View style={styles.successSpacer} />
            <View style={styles.successContent}>
              <View style={styles.successIcon}>
                <CheckIcon
                  width={48}
                  height={48}
                  style={styles.successIconCheck}
                />
              </View>
              <View style={styles.textWrapper}>
                <Text style={styles.statusText}>Your benchmark is ready!</Text>
              </View>
            </View>
            <View style={styles.successSpacer} />
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
      borderRadius: radius.eighteen,
      paddingVertical: space.four,
      paddingHorizontal: space.six,
      backgroundColor: theme.bg.softPrimary,
      alignItems: 'center',
      gap: space.six,
      minHeight: 368,
    },
    benchmarkCardSuccess: {
      width: '90%',
      borderRadius: radius.eighteen,
      paddingVertical: space.four,
      paddingHorizontal: space.six,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      gap: space.six,
      minHeight: 368,
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
      gap: space.two,
    },
    bottomSection: {
      width: '100%',
      gap: space.two,
    },
    modelCard: {
      padding: space.four,
      borderWidth: stroke.soft,
      borderRadius: radius.twelve,
      borderColor: theme.border.soft,
    },
    modelText: {
      gap: space.one,
    },
    modelBadges: {
      marginTop: space.one,
    },
    successIcon: {
      width: 100,
      height: 100,
      borderRadius: radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
    },
    successIconCheck: {
      color: theme.text.contrastPrimary,
    },
    successContent: {
      alignItems: 'center',
      gap: space.six,
    },
    successSpacer: {
      // Split the bottom section height in half to center the content
      // Half of bottomSection height: ~68px
      height: 68,
    },
  });
