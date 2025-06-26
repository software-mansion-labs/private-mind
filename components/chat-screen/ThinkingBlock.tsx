import React, { memo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import ChevronUp from '../../assets/icons/chevron-up.svg';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';

interface Props {
  content: string;
  isComplete?: boolean;
  inProgress: boolean;
}

const ThinkingBlock = memo(
  ({ content, isComplete = true, inProgress = false }: Props) => {
    const [expanded, setExpanded] = useState(!isComplete);
    const { theme } = useTheme();

    const toggleExpanded = () => {
      if (inProgress) return;

      setExpanded((prev) => !prev);
    };

    return (
      <View style={{ ...styles.thinkingBox, borderColor: theme.border.soft }}>
        <View style={styles.thinkingHeader}>
          <Text style={{ ...styles.thinkingTitle, color: theme.text.primary }}>
            Thinking...
          </Text>
          <TouchableOpacity
            onPress={toggleExpanded}
            style={styles.chevronButton}
          >
            {inProgress ? (
              <RotateLeftIcon
                width={15}
                height={15}
                style={{ color: theme.text.primary }}
              />
            ) : expanded ? (
              <ChevronUp
                width={15}
                height={8.33}
                style={{ color: theme.text.primary }}
              />
            ) : (
              <ChevronDown
                width={15}
                height={8.33}
                style={{ color: theme.text.primary }}
              />
            )}
          </TouchableOpacity>
        </View>

        {expanded ? (
          <MarkdownComponent text={content} isThinking={true} />
        ) : (
          <></>
        )}
      </View>
    );
  }
);

export default ThinkingBlock;

const styles = StyleSheet.create({
  thinkingBox: {
    borderRadius: 12,
    marginBottom: 8,
    marginTop: 8,
    borderWidth: 1,
    padding: 16,
  },
  thinkingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  thinkingTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.medium,
  },
  chevronButton: {
    padding: 4,
  },
  chevron: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  collapsedContent: {
    height: 80,
  },
});
