import React, { useMemo } from 'react';
import { View } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import DominantSourceBadge from './DominantSourceBadge';
import { attributeSourcesByBlock } from '../../utils/attributeSources';
import { type SourceDocument } from '../../database/chatRepository';

interface Props {
  text: string;
  sources: SourceDocument[];
  streaming: boolean;
  onLinkPress: (event: { url: string }) => void;
}

const AttributedAnswer = ({ text, sources, streaming, onLinkPress }: Props) => {
  const blocks = useMemo(
    () => (streaming ? [] : attributeSourcesByBlock(text, sources)),
    [streaming, text, sources]
  );

  if (streaming || blocks.every((block) => !block.source)) {
    return (
      <MarkdownComponent
        text={text}
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
