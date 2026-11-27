import React, { useId } from 'react';
import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';
import { darkTheme, lightTheme, type ThemeColors } from '../../styles/colors';
import type { ThemePreference } from '../../store/settingsStore';

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 92;
const LINE_OPACITY = 0.18;
const SURFACE_STROKE = 1;

export const THEME_PREVIEW_ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;

const surface = (colors: ThemeColors) => ({
  fill: colors.bg.chatBar,
  stroke: colors.border.group,
  strokeWidth: SURFACE_STROKE,
});

const ChatMockup = ({ colors }: { colors: ThemeColors }) => (
  <G>
    <Rect
      width={VIEWBOX_WIDTH}
      height={VIEWBOX_HEIGHT}
      fill={colors.bg.softPrimary}
    />
    <Rect
      x={10}
      y={13}
      width={58}
      height={5}
      rx={2.5}
      fill={colors.text.primary}
      fillOpacity={LINE_OPACITY}
    />
    <Rect
      x={10}
      y={22}
      width={42}
      height={5}
      rx={2.5}
      fill={colors.text.primary}
      fillOpacity={LINE_OPACITY}
    />
    <Rect x={48} y={35} width={42} height={14} rx={7} {...surface(colors)} />
    <Rect
      x={10}
      y={56}
      width={50}
      height={5}
      rx={2.5}
      fill={colors.text.primary}
      fillOpacity={LINE_OPACITY}
    />
    <Rect x={8} y={70} width={84} height={14} rx={7} {...surface(colors)} />
  </G>
);

const BOTTOM_RIGHT_TRIANGLE = `${VIEWBOX_WIDTH},0 ${VIEWBOX_WIDTH},${VIEWBOX_HEIGHT} 0,${VIEWBOX_HEIGHT}`;

export const ThemePreview = ({ variant }: { variant: ThemePreference }) => {
  const clipId = `theme-preview-dark-${useId().replace(/:/g, '')}`;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {variant === 'system' && (
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={BOTTOM_RIGHT_TRIANGLE} />
          </ClipPath>
        </Defs>
      )}
      <ChatMockup colors={variant === 'dark' ? darkTheme : lightTheme} />
      {variant === 'system' && (
        <G clipPath={`url(#${clipId})`}>
          <ChatMockup colors={darkTheme} />
        </G>
      )}
    </Svg>
  );
};
