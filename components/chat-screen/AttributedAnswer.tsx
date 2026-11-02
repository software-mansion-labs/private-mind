import React, { useMemo } from 'react';
import { View } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import DominantSourceBadge from './DominantSourceBadge';
import { attributeSourcesByBlock } from '../../utils/attributeSources';
import { stripCitations } from '../../utils/citations';
import { type SourceDocument } from '../../database/chatRepository';

interface Props {
  text: string;
  sources: SourceDocument[];
  hasSources: boolean;
  streaming: boolean;
  onLinkPress: (event: { url: string }) => void;
}

const AttributedAnswer = ({
  text,
  sources,
  hasSources,
  streaming,
  onLinkPress,
}: Props) => {
  const blocks = useMemo(
    () => (streaming ? [] : attributeSourcesByBlock(text, sources)),
    [streaming, text, sources]
  );
  const plainText = useMemo(
    () => (hasSources ? stripCitations(text) : text),
    [text, hasSources]
  );

  if (streaming || blocks.every((block) => !block.source)) {
    return (
      <MarkdownComponent
        text={plainText}
        streaming={streaming}
        onLinkPress={onLinkPress}
      />
    );
  }

  return (
    <>
      {blocks.map((block, index) => (
        <View key={`${index}-${block.source?.url ?? 'none'}`}>
          <MarkdownComponent
            text={block.text}
            streaming={false}
            onLinkPress={onLinkPress}
          />
          {block.source ? <DominantSourceBadge source={block.source} /> : null}
        </View>
      ))}
    </>
  );
};

export default AttributedAnswer;
