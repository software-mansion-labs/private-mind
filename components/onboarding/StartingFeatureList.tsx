import React, { useState } from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Pressable,
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
import { pressedOpacity } from '../../styles/pressable';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { SvgComponent } from '../../utils/SvgComponent';
import CircleButton, { CIRCLE_BUTTON_SIZE } from '../CircleButton';
import RowChevron from '../chat-screen/RowChevron';
import DownloadedBadge from '../model-hub/DownloadedBadge';
import DownloadPercent from '../model-hub/DownloadPercent';
import DownloadProgressBar from '../model-hub/DownloadProgressBar';
import DownloadProgressDetails from '../model-hub/DownloadProgressDetails';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import SourceIcon from '../../assets/icons/source.svg';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import PuzzleIcon from '../../assets/icons/puzzle.svg';
import CheckIcon from '../../assets/icons/check.svg';
import CloseIcon from '../../assets/icons/close.svg';

const ICON_TILE_SIZE = 40;
const ICON_SIZE = 24;
const SECTION_ICON_SIZE = 22;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const MIXED_MARK_WIDTH = 10;
const MIXED_MARK_HEIGHT = 2;
const CHECKBOX_HIT_SLOP = space.three;
const CANCEL_ICON_SIZE = 13;
const LOCKED_OPACITY = 0.4;
const NESTED_INDENT = space.four + ICON_TILE_SIZE + space.three;
const SECTION_TITLE = 'Additional features';

const FEATURE_ICONS: Record<StartingFeatureKey, SvgComponent> = {
  documents: SourceIcon,
  dictation: SoundwaveIcon,
};

type CheckState = 'checked' | 'mixed' | 'unchecked';

const CHECKED_ACCESSIBILITY: Record<CheckState, boolean | 'mixed'> = {
  checked: true,
  mixed: 'mixed',
  unchecked: false,
};

const formatSize = (sizeGb: number) => `${sizeGb.toFixed(2)} GB`;

const totalSizeOf = (features: StartingFeature[]) =>
  features.reduce((sum, feature) => sum + feature.sizeGb, 0);

const sectionCheckState = (
  selectable: StartingFeature[],
  ticked: StartingFeature[]
): CheckState => {
  if (ticked.length === 0) return 'unchecked';
  if (ticked.length === selectable.length) return 'checked';
  return 'mixed';
};

const sectionSizeLabel = (
  selectable: StartingFeature[],
  ticked: StartingFeature[]
) => {
  const total = formatSize(totalSizeOf(selectable));
  if (sectionCheckState(selectable, ticked) !== 'mixed') return total;
  return `${formatSize(totalSizeOf(ticked))} of ${total}`;
};

const combinedProgress = (started: StartingFeature[]) => {
  const total = totalSizeOf(started);
  if (total === 0) return 0;
  return (
    started.reduce(
      (sum, feature) => sum + feature.sizeGb * feature.progress,
      0
    ) / total
  );
};

const Checkbox = ({ state }: { state: CheckState }) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.checkbox, state !== 'unchecked' && styles.checkboxFilled]}
    >
      {state === 'checked' && (
        <CheckIcon
          width={CHECKBOX_ICON_SIZE}
          height={CHECKBOX_ICON_SIZE}
          color={theme.text.contrastPrimary}
        />
      )}
      {state === 'mixed' && <View style={styles.mixedMark} />}
    </View>
  );
};

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
    <View testID={`starting-feature-${key}-checkbox`}>
      <Checkbox state={selected ? 'checked' : 'unchecked'} />
    </View>
  );

  return (
    <ModelRow
      align="top"
      onPress={() => onToggle(key)}
      disabled={disabled}
      style={[
        styles.row,
        styles.nestedRow,
        locked && !selected && !downloaded && styles.locked,
      ]}
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

interface HeaderProps {
  features: StartingFeature[];
  selectedKeys: StartingFeatureKey[];
  startedKeys: StartingFeatureKey[];
  locked: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectAll: (selected: boolean) => void;
}

const SectionHeaderRow = ({
  features,
  selectedKeys,
  startedKeys,
  locked,
  expanded,
  onToggleExpanded,
  onSelectAll,
}: HeaderProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const selectable = features.filter(
    (feature) => feature.status === 'available'
  );
  const ticked = selectable.filter((feature) =>
    selectedKeys.includes(feature.key)
  );
  const downloading = features.filter(
    (feature) => feature.status === 'downloading'
  );
  const allDownloaded = features.every(
    (feature) => feature.status === 'downloaded'
  );
  const checkState = sectionCheckState(selectable, ticked);
  const summary = features.map((feature) => feature.name).join(' · ');
  const progress = combinedProgress(
    features.filter((feature) => startedKeys.includes(feature.key))
  );

  const handleSelectAll = () => onSelectAll(checkState !== 'checked');

  const renderDetail = () => {
    if (downloading.length > 0) {
      return (
        <View style={styles.progress}>
          <DownloadProgressBar
            progress={progress}
            accessibilityLabel={`${SECTION_TITLE} download progress`}
          />
        </View>
      );
    }
    if (allDownloaded || selectable.length === 0) return null;
    return (
      <Text style={styles.size} testID="starting-features-size">
        {sectionSizeLabel(selectable, ticked)}
      </Text>
    );
  };

  const renderControl = () => {
    if (allDownloaded) {
      return <DownloadedBadge size="medium" testID="starting-features-ready" />;
    }
    if (downloading.length > 0) {
      return <DownloadPercent progress={progress} />;
    }
    return (
      <Pressable
        onPress={handleSelectAll}
        disabled={locked}
        hitSlop={CHECKBOX_HIT_SLOP}
        style={({ pressed }) => [
          locked && styles.locked,
          pressed && pressedOpacity,
        ]}
        accessibilityRole="checkbox"
        accessibilityLabel={`Download all ${SECTION_TITLE.toLowerCase()}`}
        accessibilityState={{
          checked: CHECKED_ACCESSIBILITY[checkState],
          disabled: locked,
        }}
        testID="starting-features-select-all"
      >
        <Checkbox state={checkState} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.row, styles.headerRow]}>
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => [
          styles.headerToggle,
          pressed && pressedOpacity,
        ]}
        accessibilityRole="button"
        accessibilityLabel={SECTION_TITLE}
        accessibilityHint={summary}
        accessibilityState={{ expanded }}
        testID="starting-features-expand"
      >
        <View style={styles.iconTile}>
          <PuzzleIcon
            width={SECTION_ICON_SIZE}
            height={SECTION_ICON_SIZE}
            color={theme.text.primary}
          />
        </View>
        <ModelRowText
          title={SECTION_TITLE}
          titleAccessory={
            <RowChevron
              expanded={expanded}
              color={theme.text.defaultSecondary}
            />
          }
          subtitle={summary}
          style={styles.text}
        >
          {renderDetail()}
        </ModelRowText>
      </Pressable>
      <View style={styles.trailing}>{renderControl()}</View>
    </View>
  );
};

interface Props {
  features: StartingFeature[];
  selectedKeys: StartingFeatureKey[];
  startedKeys: StartingFeatureKey[];
  locked: boolean;
  onToggle: (key: StartingFeatureKey) => void;
  onSelectAll: (selected: boolean) => void;
  onCancel: (key: StartingFeatureKey) => void;
  onExpand?: () => void;
}

const StartingFeatureList = ({
  features,
  selectedKeys,
  startedKeys,
  locked,
  onToggle,
  onSelectAll,
  onCancel,
  onExpand,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    if (!expanded) onExpand?.();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.group}>
      <SectionHeaderRow
        features={features}
        selectedKeys={selectedKeys}
        startedKeys={startedKeys}
        locked={locked}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        onSelectAll={onSelectAll}
      />
      {expanded &&
        features.map((feature) => (
          <React.Fragment key={feature.key}>
            <View style={[styles.divider, styles.nestedDivider]} />
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
    },
    headerToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
    },
    divider: {
      height: stroke.soft,
      backgroundColor: theme.border.soft,
    },
    nestedRow: {
      paddingLeft: NESTED_INDENT,
    },
    nestedDivider: {
      marginLeft: NESTED_INDENT,
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
    checkboxFilled: {
      borderWidth: 0,
      backgroundColor: theme.bg.strongPrimary,
    },
    mixedMark: {
      width: MIXED_MARK_WIDTH,
      height: MIXED_MARK_HEIGHT,
      borderRadius: MIXED_MARK_HEIGHT / 2,
      backgroundColor: theme.text.contrastPrimary,
    },
  });
