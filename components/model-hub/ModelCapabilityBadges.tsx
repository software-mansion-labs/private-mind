import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Model } from '../../database/modelRepository';
import {
  incompatibilityLabel,
  isModelCompatible,
} from '../../utils/modelCompatibility';
import {
  THINKING_LABEL,
  VISION_LABEL,
  isCapabilityLabel,
} from '../../constants/model-labels';
import { space } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { needsUpdate } from '../../utils/modelUpdate';
import ModelBadge from './ModelBadge';

interface Props {
  model: Model;
  showLabels?: boolean;
  showCustom?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ModelCapabilityBadges = ({
  model,
  showLabels = true,
  showCustom = false,
  style,
}: Props) => {
  const isCompatible = isModelCompatible(model);
  const isOutdated = needsUpdate(model);
  const isCustom = showCustom && model.source !== 'built-in';
  const labels = showLabels
    ? (model.labels ?? []).filter((label) => !isCapabilityLabel(label))
    : [];

  if (
    isCompatible &&
    !isOutdated &&
    !isCustom &&
    !model.thinking &&
    !model.vision &&
    labels.length === 0
  ) {
    return null;
  }

  return (
    <View style={[styles.badges, style]}>
      {!isCompatible && (
        <ModelBadge label={incompatibilityLabel([model])} color="error" />
      )}
      {isOutdated &&
        (model.updateRequired ? (
          <ModelBadge label={MODEL_UPDATE_TEXT.badge} color="error" />
        ) : (
          <ModelBadge label={MODEL_UPDATE_TEXT.optionalBadge} color="neutral" />
        ))}
      {isCustom && <ModelBadge label="Custom" color="neutral" />}
      {model.thinking && <ModelBadge label={THINKING_LABEL} />}
      {model.vision && <ModelBadge label={VISION_LABEL} />}
      {labels.map((label) => (
        <ModelBadge key={label} label={label} />
      ))}
    </View>
  );
};

export default ModelCapabilityBadges;

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.one,
  },
});
