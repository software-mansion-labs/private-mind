import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useProgressRate } from '../../hooks/useProgressRate';
import {
  StartingFeature,
  StartingFeatureKey,
} from '../../hooks/useStartingFeatures';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { SvgComponent } from '../../utils/SvgComponent';
import CircleButton, { CIRCLE_BUTTON_SIZE } from '../CircleButton';
import DownloadedBadge from '../model-hub/DownloadedBadge';
import DownloadPercent from '../model-hub/DownloadPercent';
import DownloadProgressBar from '../model-hub/DownloadProgressBar';
import DownloadProgressDetails from '../model-hub/DownloadProgressDetails';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import SourceIcon from '../../assets/icons/source.svg';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import CheckIcon from '../../assets/icons/check.svg';
import CloseIcon from '../../assets/icons/close.svg';

const ICON_TILE_SIZE = 40;
const ICON_SIZE = 24;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const CANCEL_ICON_SIZE = 13.33;
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
  const disabled = locked || status !== 'available';

  const accessibilityActions: AccessibilityActionInfo[] = downloading
    ? [{ name: 'cancelDownload', label: `Cancel ${name} download` }]
    : [];

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'cancelDownload') onCancel(key);
  };

  const trailing = downloading ? (
    <CircleButton
      onPress={() => onCancel(key)}
      backgroundColor={theme.bg.tile}
      color={theme.text.primary}
      icon={CloseIcon}
      size={CANCEL_ICON_SIZE}
      testID={`starting-feature-${key}-cancel`}
    />
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
      align="top"
      onPress={() => onToggle(key)}
      disabled={disabled}
      style={[styles.row, locked && !selected && !downloaded && styles.locked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected || downloaded, disabled }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
      testID={`starting-feature-${key}`}
    >
      <View style={styles.iconTile}>
        <Icon width={ICON_SIZE} height={ICON_SIZE} color={theme.text.primary} />
      </View>
      <ModelRowText
        title={name}
        titleLines={0}
        titleAccessory={
          downloading ? <DownloadPercent progress={progress} /> : undefined
        }
        accessoryPlacement="end"
        subtitle={downloaded ? 'Ready' : description}
        style={styles.text}
      >
        {!downloaded && <Text style={styles.size}>{formatSize(sizeGb)}</Text>}
        {downloading && (
          <View style={styles.progress}>
            <DownloadProgressBar
              progress={progress}
              accessibilityLabel={`${name} download progress`}
            />
            <DownloadProgressDetails
              modelSize={sizeGb}
              progress={progress}
              rate={rate}
            />
          </View>
        )}
      </ModelRowText>
      <View style={styles.trailing}>{trailing}</View>
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
      borderRadius: radius.eighteen,
      overflow: 'hidden',
      backgroundColor: theme.bg.softPrimary,
    },
    row: {
      padding: space.four,
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
      borderRadius: radius.twelve,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    text: {
      gap: space.one,
    },
    size: {
      ...textStyles.bodySecondaryRegular,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultSecondary,
    },
    progress: {
      marginTop: space.two,
      gap: space.two,
    },
    trailing: {
      width: CIRCLE_BUTTON_SIZE,
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
  });
