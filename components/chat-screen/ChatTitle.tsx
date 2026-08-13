import React, { useCallback, useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChevronDown from '../../assets/icons/chevron-down.svg';

interface Props {
  title: string;
  modelName: string;
  isModelLoading?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  onBottomMeasured?: (bottomY: number) => void;
}

const ChatTitle = ({
  title,
  modelName,
  isModelLoading = false,
  onPress,
  showChevron = false,
  onBottomMeasured,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
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
          <View style={styles.modelRow}>
            <Text style={styles.modelName}>{modelName}</Text>
            <View style={styles.accessory} pointerEvents="none">
              {isModelLoading && (
                <ActivityIndicator
                  size="small"
                  color={styles.modelName.color}
                  style={styles.loader}
                />
              )}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.modelRow}>
          <Text style={styles.modelNameTitle}>{modelName}</Text>
          <View style={styles.accessory} pointerEvents="none">
            {isModelLoading ? (
              <ActivityIndicator
                size="small"
                color={styles.modelNameTitle.color}
                style={styles.loader}
              />
            ) : showChevron ? (
              <ChevronDown width={10} height={10} style={styles.chevron} />
            ) : null}
          </View>
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
      textAlign: 'center',
    },
    modelNameTitle: {
      color: theme.text.defaultSecondary,
      fontFamily: fontFamily.medium,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    accessory: {
      position: 'absolute',
      left: '100%',
      marginLeft: 4,
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: {
      color: theme.text.defaultSecondary,
      transform: [{ rotate: '-90deg' }],
    },
    loader: {
      transform: [{ scale: 0.65 }],
    },
  });
