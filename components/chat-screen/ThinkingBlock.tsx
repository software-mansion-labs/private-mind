import React, { memo, useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { Theme } from '../../styles/colors';

import MarkdownComponent from './MarkdownComponent';

import ChevronDown from '../../assets/icons/chevron-down.svg';
import ChevronUp from '../../assets/icons/chevron-up.svg';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';

interface Props {
  content: string;
  isComplete?: boolean;
  inProgress: boolean;
}

const ThinkingBlock = memo(
  ({ content, isComplete = true, inProgress }: Props) => {
    const [expanded, setExpanded] = useState(!isComplete);
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const toggleExpanded = () => {
      if (inProgress) return;
      setExpanded((prev) => !prev);
    };

    return (
      <View style={styles.thinkingBox}>
        <View style={styles.thinkingHeader}>
          <Text style={styles.thinkingTitle}>Thinking...</Text>
          <TouchableOpacity
            onPress={toggleExpanded}
            style={styles.chevronButton}
          >
            {inProgress ? (
              <RotateLeftIcon
                width={15}
                height={15}
                style={styles.chevronIcon}
              />
            ) : expanded ? (
              <ChevronUp width={15} height={8.33} style={styles.chevronIcon} />
            ) : (
              <ChevronDown
                width={15}
                height={8.33}
                style={styles.chevronIcon}
              />
            )}
          </TouchableOpacity>
        </View>
        {expanded && <MarkdownComponent text={content} isThinking={true} />}
      </View>
    );
  }
);

export default ThinkingBlock;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    thinkingBox: {
      borderRadius: 12,
      marginTop: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border.soft,
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
      color: theme.text.primary,
    },
    chevronButton: {
      padding: 4,
    },
    chevronIcon: {
      color: theme.text.primary,
    },
  });
