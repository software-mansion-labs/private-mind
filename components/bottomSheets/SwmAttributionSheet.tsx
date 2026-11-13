import React, { Fragment, RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { type SwmModelRole } from '../../constants/family-descriptions';
import {
  ABOUT_SWM_LABEL,
  ABOUT_SWM_URL,
  ATTRIBUTION_ROWS,
  ATTRIBUTION_SHEET_TITLE,
  OPENS_IN_BROWSER_HINT,
  SWM_ROLE_DETAILS,
  SWM_ROLE_TITLES,
  VIEW_MODEL_DETAILS_LABEL,
} from '../../constants/model-attribution';
import { openExternalUrl } from '../../utils/web/openExternalUrl';
import { SvgComponent } from '../../utils/SvgComponent';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import SwmLogo from '../../assets/icons/swm-logo.svg';
import BuildingIcon from '../../assets/icons/building.svg';
import CubeIcon from '../../assets/icons/cube.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import LockIcon from '../../assets/icons/lock-solid.svg';

export interface SwmAttributionSheetData {
  family: string;
  provider: string;
  role: SwmModelRole;
  modelUrl?: string;
}

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<SwmAttributionSheetData> | null>;
}

const LOGO_WIDTH = 56;
const LOGO_HEIGHT = 30;
const ICON_TILE_SIZE = 32;
const ICON_TILE_RADIUS = 10;
const ICON_SIZE = 16;
const ROW_PADDING = space.four;
const ROW_TEXT_INSET = ROW_PADDING + ICON_TILE_SIZE + space.three;

interface Row {
  key: string;
  icon: SvgComponent;
  title: string;
  detail: string;
}

const attributionRows = ({
  family,
  provider,
  role,
}: SwmAttributionSheetData): Row[] => [
  {
    key: 'original',
    icon: BuildingIcon,
    title: ATTRIBUTION_ROWS.original,
    detail: `${family} by ${provider}`,
  },
  {
    key: 'swm',
    icon: CubeIcon,
    title: SWM_ROLE_TITLES[role],
    detail: SWM_ROLE_DETAILS[role],
  },
  { key: 'benchmarked', icon: BenchmarkIcon, ...ATTRIBUTION_ROWS.benchmarked },
  { key: 'private', icon: LockIcon, ...ATTRIBUTION_ROWS.private },
];

const AttributionRow = ({ row }: { row: Row }) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const Icon = row.icon;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${row.title}: ${row.detail}`}
      testID={`swm-attribution-row-${row.key}`}
    >
      <View style={styles.iconTile}>
        <Icon
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={{ color: theme.text.primary }}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{row.title}</Text>
        <Text style={styles.rowDetail}>{row.detail}</Text>
      </View>
    </View>
  );
};

const SwmAttributionSheet = ({ bottomSheetModalRef }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <BackDismissibleSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      accessible={false}
    >
      {({ data }) => {
        if (!data) return null;
        const { modelUrl } = data;
        const handleViewModel = () => openExternalUrl(modelUrl);
        const handleAboutSwm = () => openExternalUrl(ABOUT_SWM_URL);

        return (
          <BottomSheetView style={styles.sheet}>
            <View style={styles.header}>
              <SwmLogo
                width={LOGO_WIDTH}
                height={LOGO_HEIGHT}
                style={{ color: theme.text.primary }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={styles.title} accessibilityRole="header">
                {ATTRIBUTION_SHEET_TITLE}
              </Text>
            </View>
            <View style={styles.group}>
              {attributionRows(data).map((row, index) => (
                <Fragment key={row.key}>
                  {index > 0 && <View style={styles.separator} />}
                  <AttributionRow row={row} />
                </Fragment>
              ))}
            </View>
            <View style={styles.buttons}>
              {modelUrl && (
                <PrimaryButton
                  text={VIEW_MODEL_DETAILS_LABEL}
                  onPress={handleViewModel}
                  accessibilityRole="link"
                  accessibilityHint={OPENS_IN_BROWSER_HINT}
                />
              )}
              <SecondaryButton
                text={ABOUT_SWM_LABEL}
                onPress={handleAboutSwm}
                style={styles.textButton}
                textStyle={styles.textButtonLabel}
                accessibilityRole="link"
                accessibilityHint={OPENS_IN_BROWSER_HINT}
              />
            </View>
          </BottomSheetView>
        );
      }}
    </BackDismissibleSheetModal>
  );
};

export default SwmAttributionSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      paddingTop: space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.three,
      gap: space.six,
      backgroundColor: theme.bg.softPrimary,
    },
    header: {
      alignItems: 'center',
      gap: space.two,
    },
    title: {
      ...textStyles.titleSheet,
      marginTop: space.two,
      textAlign: 'center',
      color: theme.text.primary,
    },
    group: {
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.softTertiary,
      overflow: 'hidden',
    },
    separator: {
      height: stroke.soft,
      marginLeft: ROW_TEXT_INSET,
      backgroundColor: theme.border.popover,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      paddingVertical: space.three,
      paddingHorizontal: ROW_PADDING,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: ICON_TILE_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.softPrimary,
    },
    rowText: {
      flex: 1,
      gap: space.half,
    },
    rowTitle: {
      ...textStyles.bodyPrimaryMedium,
      color: theme.text.primary,
    },
    rowDetail: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultTertiary,
    },
    buttons: {
      gap: space.one,
    },
    textButton: {
      borderWidth: 0,
    },
    textButtonLabel: {
      fontSize: textStyles.bodyPrimaryMedium.fontSize,
      color: theme.text.accent,
    },
  });
