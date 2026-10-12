import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Model } from '../../database/modelRepository';
import { getModelRisk } from '../../utils/modelCompatibility';
import {
  BENCHMARK_FIRST_LABEL,
  RISK_NOTICE_DISMISS_LABEL,
  getModelRiskCopy,
} from '../../constants/model-risk';
import { useModelRiskNoticeStore } from '../../store/modelRiskNoticeStore';
import { InfoAlert } from '../InfoAlert';

interface Props {
  model: Model | undefined;
}

const ModelRiskNotice = ({ model }: Props) => {
  const dismissedModelIds = useModelRiskNoticeStore(
    (state) => state.dismissedModelIds
  );
  const dismissForModel = useModelRiskNoticeStore(
    (state) => state.dismissForModel
  );

  if (!model?.isDownloaded || dismissedModelIds.includes(model.id)) {
    return null;
  }
  const risk = getModelRisk(model);
  const copy = getModelRiskCopy(risk, model.modelName);
  if (!copy) return null;

  return (
    <View style={styles.container}>
      <InfoAlert
        testID="chat-model-risk-notice"
        variant={risk.tier === 'unsafe' ? 'danger' : 'warning'}
        title={copy.title}
        text={copy.body}
        action={{
          label: BENCHMARK_FIRST_LABEL,
          onPress: () => router.push(`/benchmark?modelId=${model.id}`),
        }}
        onDismiss={() => dismissForModel(model.id)}
        dismissLabel={RISK_NOTICE_DISMISS_LABEL}
      />
    </View>
  );
};

export default ModelRiskNotice;

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
});
