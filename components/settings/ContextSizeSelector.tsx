import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useSettingsStore } from '../../store/settingsStore';
import type { Model } from '../../database/modelRepository';
import type { ConversationMemory } from '../../constants/context-window';
import {
  contextSizeOptionsFor,
  type ContextSizeOption,
  effectiveContextSize,
  type ContextSizeEnvironment,
} from '../../utils/contextSizeOptions';
import {
  isModelCompatibleWithRam,
  thisDeviceName,
} from '../../utils/modelCompatibility';
import { deviceMemoryGBOrZero } from '../../utils/deviceMemory';
import { useModelContextCapacityStore } from '../../store/modelContextCapacityStore';
import { Feedback } from '../../utils/Feedback';
import {
  CONTEXT_SIZE_MANUAL_HEADER,
  CONVERSATION_MEMORY_LABEL,
  CONVERSATION_MEMORY_OPTION_LABELS,
} from '../../constants/conversation-memory-copy';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ModelBadge from '../model-hub/ModelBadge';
import SettingsRowGroup from './SettingsRowGroup';
import SectionHeader from '../model-hub/SectionHeader';
import CheckIcon from '../../assets/icons/check.svg';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';

const CHECK_SIZE = 20;
const BADGE_COLUMN_WIDTH = 32;
const LABEL_LINE_HEIGHT = lineHeights.sm;

const useContextSizeEnvironment = (
  model?: Model | null
): ContextSizeEnvironment => {
  const modelCapacityTokens = useModelContextCapacityStore((state) =>
    model ? state.lastKnown[model.id] : undefined
  );
  return useMemo(() => {
    const deviceRamGB = deviceMemoryGBOrZero();
    return {
      model,
      deviceRamGB,
      deviceName: thisDeviceName(),
      modelCapacityTokens,
      modelFitsDevice: model
        ? isModelCompatibleWithRam(model, deviceRamGB)
        : false,
    };
  }, [model, modelCapacityTokens]);
};

export const useContextSizeLabel = (model?: Model | null): string => {
  const chosen = useSettingsStore((state) => state.conversationMemory);
  const { deviceRamGB } = useContextSizeEnvironment(model);
  return CONVERSATION_MEMORY_OPTION_LABELS[
    effectiveContextSize(chosen, deviceRamGB)
  ];
};

interface Props {
  model?: Model | null;
  disabled?: boolean;
  label?: string;
  testIDPrefix?: string;
}

export const ContextSizeSelector = ({
  model,
  disabled = false,
  label = CONVERSATION_MEMORY_LABEL,
  testIDPrefix = 'context-size',
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const chosen = useSettingsStore((state) => state.conversationMemory);
  const setConversationMemory = useSettingsStore(
    (state) => state.setConversationMemory
  );
  const env = useContextSizeEnvironment(model);
  const options = useMemo(() => contextSizeOptionsFor(env), [env]);
  const selected = effectiveContextSize(chosen, env.deviceRamGB);

  const handleSelect = (level: ConversationMemory) => {
    if (level === selected) return;
    Feedback.toggleOn();
    setConversationMemory(level);
  };

  const renderOption = (option: ContextSizeOption) => {
    const checked = option.level === selected;
    const blocked = disabled || option.disabled;
    const handlePress = () => handleSelect(option.level);
    return (
      <Pressable
        key={option.level}
        onPress={handlePress}
        disabled={blocked}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityHint={option.description}
        accessibilityState={{ checked, disabled: blocked }}
        testID={`${testIDPrefix}-${option.level}`}
        style={({ pressed }) => [
          styles.option,
          checked && styles.optionChecked,
          blocked && dimmedOpacity,
          pressed && pressedOpacity,
        ]}
      >
        <View style={styles.texts}>
          <Text
            style={[styles.optionLabel, checked && styles.optionLabelChecked]}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {option.label}
          </Text>
          <Text
            style={styles.description}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {option.description}
          </Text>
          {option.note && (
            <Text
              style={styles.note}
              testID={`${testIDPrefix}-${option.level}-note`}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              {option.note}
            </Text>
          )}
        </View>
        <View style={styles.badgeColumn}>
          {option.size && <ModelBadge label={option.size} color="neutral" />}
        </View>
        <View style={styles.checkSlot}>
          {checked && (
            <CheckIcon
              width={CHECK_SIZE}
              height={CHECK_SIZE}
              style={styles.check}
              testID={`${testIDPrefix}-${option.level}-check`}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const automatic = options.filter((option) => option.level === 'auto');
  const manual = options.filter((option) => option.level !== 'auto');
  const selectedManualIndex = manual.findIndex(
    (option) => option.level === selected
  );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.group}
      testID={`${testIDPrefix}-group`}
    >
      <SettingsRowGroup separatorInset={0}>
        {automatic.map(renderOption)}
      </SettingsRowGroup>
      <View style={styles.manual}>
        <SectionHeader title={CONTEXT_SIZE_MANUAL_HEADER} />
        <SettingsRowGroup
          separatorInset={0}
          selectedIndex={
            selectedManualIndex < 0 ? undefined : selectedManualIndex
          }
        >
          {manual.map(renderOption)}
        </SettingsRowGroup>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: {
      gap: space.four,
    },
    manual: {
      gap: space.two,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
      padding: space.four,
    },
    optionChecked: {
      backgroundColor: theme.bg.accentSoft,
    },
    check: {
      color: theme.text.accent,
    },
    badgeColumn: {
      width: BADGE_COLUMN_WIDTH,
      height: LABEL_LINE_HEIGHT,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    checkSlot: {
      width: CHECK_SIZE,
      height: LABEL_LINE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: {
      flex: 1,
      gap: space.half,
    },
    optionLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: LABEL_LINE_HEIGHT,
      color: theme.text.primary,
    },
    optionLabelChecked: {
      color: theme.text.accent,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    note: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
  });
