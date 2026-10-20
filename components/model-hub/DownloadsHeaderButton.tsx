import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import DownloadArrowIcon from '../../assets/icons/download-arrow.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  overallProgress,
  useActiveDownloads,
} from '../../hooks/useActiveDownloads';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import {
  GLASS_BUTTON_SIZE,
  HEADER_EDGE_PX,
} from '../../constants/header-actions';
import HeaderGlassButton, { headerGlassButtonFill } from '../HeaderGlassButton';

const IDLE_ICON_SIZE = 20;
const RING_ICON_SIZE = 16;
const RING_SIZE = 34;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_INSET = (GLASS_BUTTON_SIZE - RING_SIZE) / 2;
const BADGE_SIZE = 16;
const BADGE_BORDER = 1.5;

interface Props {
  onPress: () => void;
}

const DownloadsHeaderButton = ({ onPress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const downloads = useActiveDownloads();
  const count = downloads.length;
  const progress = overallProgress(downloads);
  const iconSize = count > 0 ? RING_ICON_SIZE : IDLE_ICON_SIZE;

  return (
    <View>
      <HeaderGlassButton edge="trailing">
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            headerGlassButtonFill,
            pressed && pressedOpacity,
          ]}
          hitSlop={15}
          accessibilityRole="button"
          accessibilityLabel={
            count > 0 ? `Downloads, ${count} in progress` : 'Downloads'
          }
          testID="downloads-header-button"
        >
          {count > 0 && (
            <Svg
              width={RING_SIZE}
              height={RING_SIZE}
              style={styles.ring}
              testID="downloads-progress-ring"
            >
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={theme.bg.tile}
                strokeWidth={RING_STROKE}
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={theme.bg.main}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
          )}
          <DownloadArrowIcon
            width={iconSize}
            height={iconSize}
            color={theme.text.primary}
          />
        </Pressable>
      </HeaderGlassButton>
      {count > 0 && (
        <View
          style={styles.badge}
          pointerEvents="none"
          testID="downloads-count-badge"
        >
          <Text style={styles.badgeText} allowFontScaling={false}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
};

export default DownloadsHeaderButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    ring: {
      position: 'absolute',
      top: RING_INSET,
      left: RING_INSET,
    },
    badge: {
      position: 'absolute',
      top: space.half,
      right: HEADER_EDGE_PX + space.half,
      minWidth: BADGE_SIZE,
      height: BADGE_SIZE,
      paddingHorizontal: space.one,
      borderRadius: radius.full,
      borderWidth: BADGE_BORDER,
      borderColor: theme.bg.softPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.main,
    },
    badgeText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xxs,
      lineHeight: fontSizes.xxs + 3,
      color: theme.text.onBrand,
    },
  });
