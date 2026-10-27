import React, { memo, useMemo, useState } from 'react';
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import { Platform } from 'react-native';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { space } from '../../constants/design-system';

const MD4C_FLAGS = { latexMath: true } as const;

interface Props {
  text: string;
  isUser?: boolean;
  isThinking?: boolean;
  streaming?: boolean;
  onLinkPress?: (event: { url: string }) => void;
}

const MarkdownComponent = memo(
  ({
    text,
    isUser = false,
    isThinking = false,
    streaming = false,
    onLinkPress,
  }: Props) => {
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
          marginBottom: space.three,
        },
        h1: {
          fontFamily: fontFamily.bold,
          fontSize: fontSizes.xxl,
          color: baseColor,
          lineHeight: 36,
          marginTop: space.four,
          marginBottom: space.two,
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
          marginTop: space.three,
          marginBottom: space.one,
        },
        h4: {
          fontFamily: fontFamily.bold,
          fontSize: 17,
          color: baseColor,
          lineHeight: 24,
          marginTop: space.twoHalf,
          marginBottom: space.one,
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
            ? theme.bg.codeInlineStrong
            : theme.bg.codeInline,
          borderColor: isUser
            ? theme.border.codeInlineStrong
            : theme.border.codeInline,
        },
        codeBlock: {
          fontFamily: monoFont,
          fontSize: 13,
          color: baseColor,
          backgroundColor: isUser
            ? theme.bg.codeBlockStrong
            : theme.bg.codeBlock,
          borderRadius: 10,
          padding: 14,
          marginTop: space.two,
          marginBottom: space.three,
        },
        blockquote: {
          fontFamily: fontFamily.regular,
          fontSize: baseFontSize,
          color: theme.text.defaultSecondary,
          borderColor: theme.bg.main,
          borderWidth: 3,
          gapWidth: 14,
          marginTop: space.two,
          marginBottom: space.three,
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
          marginLeft: space.five,
          marginBottom: space.three,
        },
        thematicBreak: {
          color: theme.border.soft,
          height: 1,
          marginTop: space.five,
          marginBottom: space.five,
        },
      }),
      [baseColor, baseFontSize, isUser, monoFont, theme]
    );

    const [hasStreamed, setHasStreamed] = useState(streaming);
    if (streaming && !hasStreamed) setHasStreamed(true);

    if (hasStreamed) {
      return (
        <StreamdownText
          markdown={text}
          markdownStyle={markdownStyle}
          md4cFlags={MD4C_FLAGS}
          flavor="github"
          selectable={true}
          onLinkPress={onLinkPress}
        />
      );
    }

    return (
      <EnrichedMarkdownText
        markdown={text}
        markdownStyle={markdownStyle}
        md4cFlags={MD4C_FLAGS}
        flavor="github"
        selectable={true}
        onLinkPress={onLinkPress}
      />
    );
  }
);

export default MarkdownComponent;
