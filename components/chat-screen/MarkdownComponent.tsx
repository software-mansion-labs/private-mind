import React, { memo, useMemo } from 'react';
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from 'react-native-enriched-markdown';
import { Platform } from 'react-native';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  text: string;
  isUser?: boolean;
  isThinking?: boolean;
}

const MarkdownComponent = memo(
  ({ text, isUser = false, isThinking = false }: Props) => {
    const { theme } = useTheme();
    const baseColor = theme.text.primary;
    const baseFontSize = isThinking ? fontSizes.sm : fontSizes.md;
    const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

    const markdownStyle: MarkdownStyle = useMemo(
      () => ({
        paragraph: {
          fontFamily: fontFamily.regular,
          fontSize: baseFontSize,
          color: baseColor,
          lineHeight: Platform.select({
            ios: lineHeights.md,
            android: lineHeights.md + 2,
            default: lineHeights.md,
          }),
          marginBottom: 12,
        },
        h1: {
          fontFamily: fontFamily.bold,
          fontSize: fontSizes.xxl,
          color: baseColor,
          lineHeight: 36,
          marginTop: 16,
          marginBottom: 8,
        },
        h2: {
          fontFamily: fontFamily.bold,
          fontSize: fontSizes.xl,
          color: baseColor,
          lineHeight: 30,
          marginTop: 14,
          marginBottom: 6,
        },
        h3: {
          fontFamily: fontFamily.bold,
          fontSize: fontSizes.lg,
          color: baseColor,
          lineHeight: 26,
          marginTop: 12,
          marginBottom: 4,
        },
        h4: {
          fontFamily: fontFamily.bold,
          fontSize: 17,
          color: baseColor,
          lineHeight: 24,
          marginTop: 10,
          marginBottom: 4,
        },
        strong: {
          color: baseColor,
        },
        em: {
          color: theme.text.defaultSecondary,
        },
        link: {
          color: theme.bg.main,
          underline: true,
        },
        code: {
          fontFamily: monoFont,
          fontSize: baseFontSize - 1,
          color: baseColor,
          backgroundColor: isUser
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(0,0,0,0.06)',
          borderColor: isUser
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.08)',
        },
        codeBlock: {
          fontFamily: monoFont,
          fontSize: 13,
          color: baseColor,
          backgroundColor: isUser
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(0,0,0,0.05)',
          borderRadius: 10,
          padding: 14,
          marginTop: 8,
          marginBottom: 12,
        },
        blockquote: {
          fontFamily: fontFamily.regular,
          fontSize: baseFontSize,
          color: theme.text.defaultSecondary,
          borderColor: theme.bg.main,
          borderWidth: 3,
          gapWidth: 14,
          marginTop: 8,
          marginBottom: 12,
        },
        list: {
          fontSize: baseFontSize,
          fontFamily: fontFamily.regular,
          color: baseColor,
          lineHeight: lineHeights.md,
          bulletColor: theme.text.defaultTertiary,
          bulletSize: 5,
          markerColor: theme.text.defaultSecondary,
          gapWidth: 10,
          marginLeft: 20,
          marginBottom: 12,
        },
        thematicBreak: {
          color: theme.border.soft,
          height: 1,
          marginTop: 20,
          marginBottom: 20,
        },
      }),
      [baseColor, baseFontSize, isUser, monoFont, theme]
    );

    return (
      <EnrichedMarkdownText
        markdown={text}
        markdownStyle={markdownStyle}
        selectable={true}
      />
    );
  }
);

export default MarkdownComponent;
