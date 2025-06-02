import React, { memo } from 'react';
import Markdown from 'react-native-markdown-display';
import ColorPalette from '../../colors';
import { Platform } from 'react-native';
import { fontFamily } from '../../fontFamily';

interface Props {
  text: string;
  isUser?: boolean;
}

const MarkdownComponent = memo(({ text, isUser = false }: Props) => {
  const baseColor = isUser ? ColorPalette.primary : ColorPalette.primary;

  return (
    <Markdown
      style={{
        body: {
          color: baseColor,
          fontSize: 16,
          alignSelf: 'flex-start',
          fontFamily: fontFamily.regular,
          lineHeight: 24,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 8,
          fontFamily: fontFamily.regular,
          lineHeight: 24,
        },
        heading1: {
          fontSize: 22,
          color: baseColor,
          marginTop: 16,
          marginBottom: 8,
          fontFamily: fontFamily.bold,
          lineHeight: 24,
        },
        heading2: {
          fontSize: 20,
          color: baseColor,
          marginTop: 14,
          marginBottom: 6,
          fontFamily: fontFamily.bold,
          lineHeight: 24,
        },
        heading3: {
          fontSize: 18,
          color: baseColor,
          marginTop: 12,
          marginBottom: 4,
          fontFamily: fontFamily.bold,
          lineHeight: 24,
        },
        heading4: {
          fontSize: 17,
          color: baseColor,
          marginTop: 10,
          marginBottom: 4,
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
          fontFamily: fontFamily.italic,
          lineHeight: 24,
        },
        bullet_list: {
          marginTop: 8,
          marginBottom: 8,
          fontFamily: fontFamily.regular,
          lineHeight: 24,
        },
        ordered_list: {
          marginTop: 8,
          marginBottom: 8,
          fontFamily: fontFamily.regular,
          lineHeight: 24,
        },
        list_item: {
          marginBottom: 4,
          flexDirection: 'row',
          alignItems: 'flex-start',
          fontFamily: fontFamily.regular,
          lineHeight: 24,
        },
        bullet_list_icon: {
          color: baseColor,
          marginRight: 8,
          fontSize: 16,
          fontFamily: fontFamily.regular,
          lineHeight: 24,
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
          backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
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
          borderLeftColor: ColorPalette.info,
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
          borderLeftColor: ColorPalette.info,
        },
        link: {
          color: ColorPalette.info,
          textDecorationLine: 'underline',
          fontFamily: fontFamily.regular,
          fontSize: 16,
          lineHeight: 24,
        },
        blockquote: {
          backgroundColor: isUser
            ? 'rgba(255,255,255,0.1)'
            : ColorPalette.seaBlueLight,
          borderLeftWidth: 4,
          borderLeftColor: ColorPalette.info,
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
          backgroundColor: isUser ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
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
});

export default MarkdownComponent;
