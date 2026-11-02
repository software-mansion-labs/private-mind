import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useProgressRate } from '../../hooks/useProgressRate';
import {
  StartingFeature,
  StartingFeatureKey,
} from '../../hooks/useStartingFeatures';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import {
  formatDownloadPercent,
  hasDownloadStarted,
} from '../../utils/downloadProgress';
import { formatTimeLeft, secondsLeft } from '../../utils/downloadEta';
import { SvgComponent } from '../../utils/SvgComponent';
import SpinningCircle from '../SpinningCircle';
import DownloadedBadge from '../model-hub/DownloadedBadge';
import DownloadProgressBar from '../model-hub/DownloadProgressBar';
import ModelRow from '../model-hub/ModelRow';
import SourceIcon from '../../assets/icons/source.svg';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import CheckIcon from '../../assets/icons/check.svg';
import CloseIcon from '../../assets/icons/close.svg';

const ICON_TILE_SIZE = 32;
const ICON_TILE_RADIUS = 10;
const ICON_SIZE = 18;
const ROW_MIN_HEIGHT = 60;
const TRAILING_SIZE = 28;
const CHECKBOX_SIZE = 20;
const CHECKBOX_RADIUS = 6;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 12;
const CANCEL_ICON_SIZE = 10;
const SPINNER_SIZE = 12;
const SPINNER_STROKE = 2;
const BAR_HEIGHT = 3;
const LOCKED_OPACITY = 0.4;

const FEATURE_ICONS: Record<StartingFeatureKey, SvgComponent> = {
  documents: SourceIcon,
  dictation: SoundwaveIcon,
};

const formatSize = (sizeGb: number) => `${sizeGb.toFixed(2)} GB`;

interface RowProps {
  feature: StartingFeature;
  selected: boolean;
  locked: boolean;
  onToggle: (key: StartingFeatureKey) => void;
  onCancel: (key: StartingFeatureKey) => void;
}

const StartingFeatureRow = ({
  feature,
  selected,
  locked,
  onToggle,
  onCancel,
}: RowProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { key, name, description, sizeGb, status, progress } = feature;
  const rate = useProgressRate(status === 'downloading' ? progress : 0);
  const Icon = FEATURE_ICONS[key];

  const downloading = status === 'downloading';
  const downloaded = status === 'downloaded';
  const started = downloading && hasDownloadStarted(progress);
  const remaining = started ? secondsLeft(progress, rate) : undefined;
  const disabled = locked || status !== 'available';

  const meta = downloaded
    ? 'Ready'
    : started
      ? [
          formatDownloadPercent(progress),
          remaining !== undefined && formatTimeLeft(remaining),
        ]
          .filter(Boolean)
          .join(' · ')
      : downloading
        ? formatSize(sizeGb)
        : `${description} · ${formatSize(sizeGb)}`;

  const trailing = downloading ? (
    <Pressable
      onPress={() => onCancel(key)}
      style={({ pressed }) => [styles.cancel, pressed && pressedOpacity]}
      accessibilityRole="button"
      accessibilityLabel={`Cancel ${name} download`}
      testID={`starting-feature-${key}-cancel`}
    >
      <CloseIcon
        width={CANCEL_ICON_SIZE}
        height={CANCEL_ICON_SIZE}
        color={theme.text.primary}
      />
    </Pressable>
  ) : downloaded ? (
    <DownloadedBadge size="medium" testID={`starting-feature-${key}-ready`} />
  ) : (
    <View
      style={[styles.checkbox, selected && styles.checkboxSelected]}
      testID={`starting-feature-${key}-checkbox`}
    >
      {selected && (
        <CheckIcon
          width={CHECKBOX_ICON_SIZE}
          height={CHECKBOX_ICON_SIZE}
          color={theme.text.contrastPrimary}
        />
      )}
    </View>
  );

  return (
    <ModelRow
      onPress={() => onToggle(key)}
      disabled={disabled}
      style={[styles.row, locked && !selected && !downloaded && styles.locked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected || downloaded, disabled }}
      testID={`starting-feature-${key}`}
    >
      <View style={styles.iconTile}>
        <Icon width={ICON_SIZE} height={ICON_SIZE} color={theme.text.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          {downloading && !started && (
            <SpinningCircle
              size={SPINNER_SIZE}
              strokeWidth={SPINNER_STROKE}
              trackColor={theme.bg.tile}
              arcColor={theme.bg.main}
              testID={`starting-feature-${key}-starting`}
            />
          )}
          <Text
            style={[styles.meta, started && styles.metaActive]}
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
      </View>
      <View style={styles.trailing}>{trailing}</View>
      {started && (
        <View style={styles.bar}>
          <DownloadProgressBar
            progress={progress}
            height={BAR_HEIGHT}
            accessibilityLabel={`${name} download progress`}
          />
        </View>
      )}
    </ModelRow>
  );
};

interface Props {
  features: StartingFeature[];
  selectedKeys: StartingFeatureKey[];
  locked: boolean;
  onToggle: (key: StartingFeatureKey) => void;
  onCancel: (key: StartingFeatureKey) => void;
}

const StartingFeatureList = ({
  features,
  selectedKeys,
  locked,
  onToggle,
  onCancel,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.group}>
      {features.map((feature, index) => (
        <React.Fragment key={feature.key}>
          {index > 0 && <View style={styles.divider} />}
          <StartingFeatureRow
            feature={feature}
            selected={selectedKeys.includes(feature.key)}
            locked={locked}
            onToggle={onToggle}
            onCancel={onCancel}
          />
        </React.Fragment>
      ))}
    </View>
  );
};

export default StartingFeatureList;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: {
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
      borderRadius: radius.twelve,
      overflow: 'hidden',
      backgroundColor: theme.bg.softPrimary,
    },
    row: {
      minHeight: ROW_MIN_HEIGHT,
      paddingVertical: space.three,
      paddingLeft: space.three,
      paddingRight: space.three,
    },
    divider: {
      height: stroke.soft,
      backgroundColor: theme.border.soft,
    },
    locked: {
      opacity: LOCKED_OPACITY,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: ICON_TILE_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.primary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
    },
    meta: {
      flexShrink: 1,
      ...textStyles.bodyTertiaryRegular,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultSecondary,
    },
    metaActive: {
      color: theme.text.accent,
    },
    trailing: {
      width: TRAILING_SIZE,
      alignItems: 'center',
    },
    checkbox: {
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      borderRadius: CHECKBOX_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: CHECKBOX_BORDER_WIDTH,
      borderColor: theme.border.soft,
    },
    checkboxSelected: {
      borderWidth: 0,
      backgroundColor: theme.bg.strongPrimary,
    },
    cancel: {
      width: TRAILING_SIZE,
      height: TRAILING_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
  });
