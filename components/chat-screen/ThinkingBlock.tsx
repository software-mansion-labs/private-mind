import React, { memo, useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import MarkdownComponent from './MarkdownComponent';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import ChevronUp from '../../assets/icons/chevron-up.svg';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';
import { Feedback } from '../../utils/Feedback';

interface Props {
  content: string;
  isComplete?: boolean;
  inProgress: boolean;
}

const ThinkingBlock = memo(
  ({ content, isComplete = true, inProgress }: Props) => {
    const [expanded, setExpanded] = useState(!isComplete);
    const { styles } = useThemedStyles(createStyles);

    const title = inProgress ? 'Thinking…' : 'Thoughts';

    const toggleExpanded = () => {
      if (inProgress) return;
      Feedback.sheetOpen();
      setExpanded((prev) => !prev);
    };

    return (
      <View style={styles.thinkingBox}>
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => [
            styles.thinkingHeader,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.thinkingTitle}>{title}</Text>
          <View style={styles.chevronButton}>
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
          </View>
        </Pressable>
        {expanded && (
          <MarkdownComponent
            text={content}
            isThinking={true}
            streaming={inProgress}
          />
        )}
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
    pressed: {
      opacity: 0.6,
    },
    chevronButton: {
      padding: 4,
    },
    chevronIcon: {
      color: theme.text.primary,
    },
  });
