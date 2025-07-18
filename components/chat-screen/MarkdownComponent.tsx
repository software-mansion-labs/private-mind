import React, { memo } from 'react';
import Markdown from 'react-native-markdown-display';
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
    const baseColor = isUser ? theme.text.primary : theme.text.primary;
    const baseFontSize = isThinking ? fontSizes.sm : fontSizes.md;

    return (
      <Markdown
        style={{
          body: {
            color: baseColor,
            fontSize: baseFontSize,
            fontFamily: fontFamily.regular,
            lineHeight: lineHeights.md,
          },
          paragraph: {
            fontFamily: fontFamily.regular,
            lineHeight: lineHeights.md,
          },
          heading1: {
            fontSize: fontSizes.xxl,
            color: baseColor,
            marginBottom: 8,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          heading2: {
            fontSize: 20,
            color: baseColor,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          heading3: {
            fontSize: 18,
            color: baseColor,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          heading4: {
            fontSize: 17,
            color: baseColor,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          strong: {
            fontSize: 16,
            color: baseColor,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          em: {
            color: baseColor,
            fontFamily: fontFamily.regularItalic,
            lineHeight: 24,
          },
          bullet_list: {
            fontFamily: fontFamily.regular,
            lineHeight: 24,
          },
          ordered_list: {
            fontFamily: fontFamily.regular,
            lineHeight: 24,
          },
          list_item: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            fontFamily: fontFamily.regular,
            lineHeight: 24,
          },
          bullet_list_icon: {
            color: baseColor,
            marginRight: 8,
            fontSize: 30,
            fontFamily: fontFamily.regular,
            lineHeight: 30,
          },
          bullet_list_content: {
            flex: 1,
            color: baseColor,
            fontSize: 16,
            fontFamily: fontFamily.regular,
            lineHeight: 24,
          },
          ordered_list_icon: {
            color: baseColor,
            marginRight: 8,
            fontSize: 16,
            fontFamily: fontFamily.bold,
            lineHeight: 24,
          },
          ordered_list_content: {
            flex: 1,
            color: baseColor,
            fontSize: 16,
            fontFamily: fontFamily.regular,
            lineHeight: 24,
          },
          code_inline: {
            backgroundColor: isUser
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(0,0,0,0.1)',
            color: baseColor,
            fontSize: 15,
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          },
          code_block: {
            backgroundColor: isUser
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(0,0,0,0.08)',
            color: baseColor,
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            marginTop: 8,
            marginBottom: 8,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            borderLeftWidth: 3,
          },
          fence: {
            backgroundColor: isUser
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(0,0,0,0.08)',
            color: baseColor,
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            marginTop: 8,
            marginBottom: 8,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            borderLeftWidth: 3,
          },
          link: {
            textDecorationLine: 'underline',
            fontFamily: fontFamily.regular,
            fontSize: 16,
            lineHeight: 24,
          },
          blockquote: {
            borderLeftWidth: 4,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            marginTop: 8,
            marginBottom: 8,
            borderRadius: 4,
            fontFamily: fontFamily.regular,
          },
          hr: {
            backgroundColor: isUser
              ? 'rgba(255,255,255,0.3)'
              : 'rgba(0,0,0,0.2)',
            height: 1,
            marginTop: 16,
            marginBottom: 16,
            lineHeight: 24,
            fontFamily: fontFamily.regular,
          },
        }}
      >
        {text}
      </Markdown>
    );
  }
);

export default MarkdownComponent;
