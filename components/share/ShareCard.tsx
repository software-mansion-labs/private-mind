import React, { type Ref } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text,
} from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily } from '../../styles/fontStyles';
import { stroke } from '../../constants/design-system';
import { isDarkTheme, mixColors, type Theme } from '../../styles/colors';
import { type ShareCardContent } from '../../utils/shareUsageCard';

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 480;

export const SHARE_CARD_RADIUS = 28;
const PADDING = 24;
const PANEL_RADIUS = 20;
const PANEL_TOP = 252;
const PANEL_HEIGHT = 120;
const PANEL_ROW_HEIGHT = 60;
const PANEL_INSET = 20;
const PANEL_WIDTH = SHARE_CARD_WIDTH - PADDING * 2;
const THIRD_COLUMN_WIDTH = 104;
const HALF_COLUMN_WIDTH = 156;
const DIVIDER_INSET = 12;

const LOGO_PATH =
  'M270.5 0C419.893 0 541 118.742 541 265.217V530.435H419.275V610H338.125V450.87H459.85V265.217C459.85 162.685 375.075 79.5652 270.5 79.5652C165.925 79.5652 81.15 162.685 81.15 265.217C81.15 349.318 138.185 420.356 216.4 443.18V610H135.25V494.946C54.3991 449.089 0 363.384 0 265.217C0 118.742 121.107 0 270.5 0Z';
const LOGO_VIEWBOX_HEIGHT = 610;
const LOGO_HEIGHT = 26;
const LOGO_TOP = 24;
const APP_NAME_X = 58;
const APP_NAME_BASELINE = 44;
const APP_NAME_SIZE = 18;

const BADGE_WIDTH = 108;
const BADGE_HEIGHT = 26;
const BADGE_TOP = 24;
const BADGE_TEXT_SIZE = 11;
const BADGE_BASELINE = 41;

const OWNER_BASELINE = 112;
const OWNER_SIZE = 18;
const PAGES_BASELINE = 190;
const PAGES_SIZE = 76;
const PAGES_UNIT_BASELINE = 226;
const PAGES_UNIT_SIZE = 24;

const STAT_VALUE_SIZE = 19;
const STAT_LABEL_SIZE = 11;
const STAT_VALUE_OFFSET = 32;
const STAT_LABEL_OFFSET = 50;
const DETAIL_LABEL_OFFSET = 22;
const DETAIL_VALUE_OFFSET = 44;
const DETAIL_VALUE_SIZE = 15;

const LOCK_PATH =
  'M11 5C11 4.49336 10.84 3.71081 10.3887 3.08398C9.97406 2.50819 9.274 2 8 2C6.726 2 6.02594 2.50819 5.61133 3.08398C5.16001 3.71081 5 4.49336 5 5V6H11V5ZM2 18H14V8H2V18ZM7 14V12C7 11.4477 7.44772 11 8 11C8.55229 11 9 11.4477 9 12V14C9 14.5523 8.55229 15 8 15C7.44772 15 7 14.5523 7 14ZM13 6H15C15.5523 6 16 6.44772 16 7V19C16 19.5523 15.5523 20 15 20H1C0.447715 20 0 19.5523 0 19V7C0 6.44772 0.447715 6 1 6H3V5C3 4.17339 3.23977 2.95579 3.98828 1.91602C4.77368 0.825186 6.07408 0 8 0C9.92592 0 11.2263 0.825186 12.0117 1.91602C12.7602 2.95579 13 4.17339 13 5V6Z';
const LOCK_TILE_SIZE = 40;
const LOCK_TILE_RADIUS = 12;
const LOCK_TILE_TOP = 392;
const LOCK_ICON_LEFT = 12;
const LOCK_ICON_TOP = 10;
const PRIVACY_TEXT_X = PADDING + LOCK_TILE_SIZE + 12;
const PRIVACY_TITLE_BASELINE = 408;
const PRIVACY_TITLE_SIZE = 16;
const PRIVACY_DETAIL_BASELINE = 427;
const PRIVACY_DETAIL_SIZE = 12;

const FOOTER_BASELINE = 460;
const FOOTER_SIZE = 11;

const GLOW_TOP_X = 320;
const GLOW_TOP_Y = 20;
const GLOW_TOP_RADIUS = 240;
const GLOW_BOTTOM_X = 0;
const GLOW_BOTTOM_Y = 480;
const GLOW_BOTTOM_RADIUS = 200;

interface CardPalette {
  backgroundTop: string;
  backgroundBottom: string;
  glow: string;
  glowOpacity: number;
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  logo: string;
  badgeFill: string;
  panelFill: string;
  panelStroke: string;
  divider: string;
  lockTile: string;
}

const LIGHT_GLOW_OPACITY = 0.28;
const DARK_GLOW_OPACITY = 0.55;
const DARK_BACKGROUND_DEPTH = 0.82;

const paletteFor = (theme: Theme): CardPalette => {
  const dark = isDarkTheme(theme);
  return {
    backgroundTop: dark
      ? mixColors(theme.bg.main, theme.bg.softPrimary, DARK_BACKGROUND_DEPTH)
      : theme.bg.toast,
    backgroundBottom: theme.bg.softPrimary,
    glow: theme.bg.main,
    glowOpacity: dark ? DARK_GLOW_OPACITY : LIGHT_GLOW_OPACITY,
    primary: theme.text.primary,
    secondary: theme.text.defaultSecondary,
    tertiary: theme.text.defaultTertiary,
    accent: theme.text.accent,
    logo: dark ? theme.text.accent : theme.bg.main,
    badgeFill: theme.bg.accentSoft,
    panelFill: theme.bg.chatBarBadge,
    panelStroke: theme.border.popover,
    divider: theme.border.popover,
    lockTile: theme.bg.accentSoft,
  };
};

interface Props {
  ref?: Ref<Svg>;
  content: ShareCardContent;
  width: number;
}

interface StatProps {
  x: number;
  top: number;
  value: string;
  label: string;
  palette: CardPalette;
}

const Stat = ({ x, top, value, label, palette }: StatProps) => (
  <G>
    <Text
      x={x}
      y={top + STAT_VALUE_OFFSET}
      fontFamily={fontFamily.bold}
      fontSize={STAT_VALUE_SIZE}
      fill={palette.primary}
    >
      {value}
    </Text>
    <Text
      x={x}
      y={top + STAT_LABEL_OFFSET}
      fontFamily={fontFamily.medium}
      fontSize={STAT_LABEL_SIZE}
      fill={palette.tertiary}
    >
      {label}
    </Text>
  </G>
);

const Detail = ({ x, top, value, label, palette }: StatProps) => (
  <G>
    <Text
      x={x}
      y={top + DETAIL_LABEL_OFFSET}
      fontFamily={fontFamily.medium}
      fontSize={STAT_LABEL_SIZE}
      fill={palette.tertiary}
    >
      {label}
    </Text>
    <Text
      x={x}
      y={top + DETAIL_VALUE_OFFSET}
      fontFamily={fontFamily.bold}
      fontSize={DETAIL_VALUE_SIZE}
      fill={palette.primary}
    >
      {value}
    </Text>
  </G>
);

export const ShareCard = ({ ref, content, width }: Props) => {
  const { theme } = useTheme();
  const palette = paletteFor(theme);
  const height = Math.round((width * SHARE_CARD_HEIGHT) / SHARE_CARD_WIDTH);
  const logoScale = LOGO_HEIGHT / LOGO_VIEWBOX_HEIGHT;
  const panelLeft = PADDING;
  const columnLeft = panelLeft + PANEL_INSET;
  const secondRowTop = PANEL_TOP + PANEL_ROW_HEIGHT;
  const badgeLeft = SHARE_CARD_WIDTH - PADDING - BADGE_WIDTH;

  return (
    <Svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}`}
      accessible
      accessibilityLabel={`${content.owner} ${content.pages} ${content.pagesUnit}. ${content.tokens} tokens, ${content.words} words, ${content.chats} chats. 0 bytes sent to the cloud.`}
    >
      <Defs>
        <LinearGradient id="cardBackground" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={palette.backgroundTop} />
          <Stop offset="1" stopColor={palette.backgroundBottom} />
        </LinearGradient>
        <RadialGradient id="glowTop" cx="50%" cy="50%" r="50%">
          <Stop
            offset="0"
            stopColor={palette.glow}
            stopOpacity={palette.glowOpacity}
          />
          <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="50%" cy="50%" r="50%">
          <Stop
            offset="0"
            stopColor={palette.glow}
            stopOpacity={palette.glowOpacity / 2}
          />
          <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect
        width={SHARE_CARD_WIDTH}
        height={SHARE_CARD_HEIGHT}
        fill="url(#cardBackground)"
      />
      <Circle
        cx={GLOW_TOP_X}
        cy={GLOW_TOP_Y}
        r={GLOW_TOP_RADIUS}
        fill="url(#glowTop)"
      />
      <Circle
        cx={GLOW_BOTTOM_X}
        cy={GLOW_BOTTOM_Y}
        r={GLOW_BOTTOM_RADIUS}
        fill="url(#glowBottom)"
      />
      <G transform={`translate(${PADDING} ${LOGO_TOP}) scale(${logoScale})`}>
        <Path d={LOGO_PATH} fill={palette.logo} />
      </G>
      <Text
        x={APP_NAME_X}
        y={APP_NAME_BASELINE}
        fontFamily={fontFamily.bold}
        fontSize={APP_NAME_SIZE}
        fill={palette.primary}
      >
        Private Mind
      </Text>
      <Rect
        x={badgeLeft}
        y={BADGE_TOP}
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        rx={BADGE_HEIGHT / 2}
        fill={palette.badgeFill}
      />
      <Text
        x={badgeLeft + BADGE_WIDTH / 2}
        y={BADGE_BASELINE}
        textAnchor="middle"
        fontFamily={fontFamily.medium}
        fontSize={BADGE_TEXT_SIZE}
        fill={palette.accent}
      >
        100% on-device AI
      </Text>
      <Text
        x={PADDING}
        y={OWNER_BASELINE}
        fontFamily={fontFamily.medium}
        fontSize={OWNER_SIZE}
        fill={palette.secondary}
      >
        {content.owner}
      </Text>
      <Text
        x={PADDING}
        y={PAGES_BASELINE}
        fontFamily={fontFamily.bold}
        fontSize={PAGES_SIZE}
        fill={palette.accent}
      >
        {content.pages}
      </Text>
      <Text
        x={PADDING}
        y={PAGES_UNIT_BASELINE}
        fontFamily={fontFamily.medium}
        fontSize={PAGES_UNIT_SIZE}
        fill={palette.primary}
      >
        {content.pagesUnit}
      </Text>
      <Rect
        x={panelLeft}
        y={PANEL_TOP}
        width={PANEL_WIDTH}
        height={PANEL_HEIGHT}
        rx={PANEL_RADIUS}
        fill={palette.panelFill}
        stroke={palette.panelStroke}
        strokeWidth={stroke.soft}
      />
      <Line
        x1={panelLeft + DIVIDER_INSET}
        x2={panelLeft + PANEL_WIDTH - DIVIDER_INSET}
        y1={secondRowTop}
        y2={secondRowTop}
        stroke={palette.divider}
        strokeWidth={stroke.soft}
      />
      <Stat
        x={columnLeft}
        top={PANEL_TOP}
        value={content.tokens}
        label="tokens"
        palette={palette}
      />
      <Stat
        x={columnLeft + THIRD_COLUMN_WIDTH}
        top={PANEL_TOP}
        value={content.words}
        label="words"
        palette={palette}
      />
      <Stat
        x={columnLeft + THIRD_COLUMN_WIDTH * 2}
        top={PANEL_TOP}
        value={content.chats}
        label="chats"
        palette={palette}
      />
      <Detail
        x={columnLeft}
        top={secondRowTop}
        value={content.mostUsedModel}
        label="Most used model"
        palette={palette}
      />
      <Detail
        x={columnLeft + HALF_COLUMN_WIDTH}
        top={secondRowTop}
        value={content.bestSpeed}
        label="Best speed"
        palette={palette}
      />
      <Rect
        x={PADDING}
        y={LOCK_TILE_TOP}
        width={LOCK_TILE_SIZE}
        height={LOCK_TILE_SIZE}
        rx={LOCK_TILE_RADIUS}
        fill={palette.lockTile}
      />
      <G
        transform={`translate(${PADDING + LOCK_ICON_LEFT} ${LOCK_TILE_TOP + LOCK_ICON_TOP})`}
      >
        <Path d={LOCK_PATH} fill={palette.accent} />
      </G>
      <Text
        x={PRIVACY_TEXT_X}
        y={PRIVACY_TITLE_BASELINE}
        fontFamily={fontFamily.bold}
        fontSize={PRIVACY_TITLE_SIZE}
        fill={palette.primary}
      >
        0 bytes sent to the cloud
      </Text>
      <Text
        x={PRIVACY_TEXT_X}
        y={PRIVACY_DETAIL_BASELINE}
        fontFamily={fontFamily.regular}
        fontSize={PRIVACY_DETAIL_SIZE}
        fill={palette.secondary}
      >
        Everything stayed on my phone.
      </Text>
      <Text
        x={PADDING}
        y={FOOTER_BASELINE}
        fontFamily={fontFamily.medium}
        fontSize={FOOTER_SIZE}
        fill={palette.tertiary}
      >
        Free on the App Store and Google Play
      </Text>
    </Svg>
  );
};
