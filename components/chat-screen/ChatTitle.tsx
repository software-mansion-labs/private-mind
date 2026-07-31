import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChevronDown from '../../assets/icons/chevron-down.svg';

interface Props {
  title: string;
  modelName: string;
  onPress?: () => void;
  showChevron?: boolean;
  onBottomMeasured?: (bottomY: number) => void;
}

const ChatTitle = ({
  title,
  modelName,
  onPress,
  showChevron = false,
  onBottomMeasured,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const containerRef = useRef<View>(null);
  const lastReportedBottom = useRef<number | null>(null);
  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y, _width, height) => {
      const bottom = Math.round(y + height);
      if (bottom !== lastReportedBottom.current) {
        lastReportedBottom.current = bottom;
        onBottomMeasured?.(bottom);
      }
    });
  }, [onBottomMeasured]);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useEffect(() => {
    if (!onBottomMeasured) return;
    const frame = requestAnimationFrame(handleLayout);
    return () => cancelAnimationFrame(frame);
  }, [handleLayout, onBottomMeasured, windowWidth, windowHeight]);

  return (
    <Pressable
      ref={containerRef}
      onLayout={onBottomMeasured ? handleLayout : undefined}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.titleContainer,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      {title !== '' ? (
        <>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text style={styles.modelName}>{modelName}</Text>
        </>
      ) : (
        <View style={styles.modelRow}>
          <Text style={styles.modelNameTitle}>{modelName}</Text>
          {showChevron && (
            <ChevronDown width={10} height={10} style={styles.chevron} />
          )}
        </View>
      )}
    </Pressable>
  );
};

export default ChatTitle;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    titleContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.6,
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    modelName: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      width: '100%',
      textAlign: 'center',
    },
    modelNameTitle: {
      color: theme.text.defaultSecondary,
      fontFamily: fontFamily.medium,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chevron: {
      color: theme.text.defaultSecondary,
      transform: [{ rotate: '-90deg' }],
    },
  });
