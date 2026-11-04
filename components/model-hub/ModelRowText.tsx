import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { space, textStyles } from '../../constants/design-system';

export type SubtitleTone = 'secondary' | 'tertiary';
export type AccessoryPlacement = 'inline' | 'end';

interface Props {
  title: string;
  titleAccessory?: React.ReactNode;
  accessoryPlacement?: AccessoryPlacement;
  titleLines?: number;
  titleStyle?: StyleProp<TextStyle>;
  titleTestID?: string;
  subtitle?: string;
  subtitleTone?: SubtitleTone;
  subtitleLines?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const ModelRowText = ({
  title,
  titleAccessory,
  accessoryPlacement = 'inline',
  titleLines = 1,
  titleStyle,
  titleTestID,
  subtitle,
  subtitleTone = 'secondary',
  subtitleLines,
  style,
  children,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const titleText = (
    <Text
      style={[styles.title, titleStyle]}
      numberOfLines={titleLines}
      testID={titleTestID}
    >
      {title}
    </Text>
  );

  return (
    <View style={[styles.text, style]}>
      {titleAccessory ? (
        <View
          style={
            accessoryPlacement === 'end' ? styles.titleRowEnd : styles.titleRow
          }
        >
          {titleText}
          {accessoryPlacement === 'inline' ? (
            <View style={styles.firstLineSlot}>{titleAccessory}</View>
          ) : (
            titleAccessory
          )}
        </View>
      ) : (
        titleText
      )}
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            subtitleTone === 'tertiary' && styles.subtitleTertiary,
          ]}
          numberOfLines={subtitleLines}
        >
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
};

export default ModelRowText;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    text: {
      flex: 1,
      minWidth: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.four,
    },
    firstLineSlot: {
      height: textStyles.bodyPrimaryMedium.lineHeight,
      justifyContent: 'center',
    },
    titleRowEnd: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.two,
    },
    title: {
      flexShrink: 1,
      ...textStyles.bodyPrimaryMedium,
      color: theme.text.primary,
    },
    subtitle: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultSecondary,
    },
    subtitleTertiary: {
      color: theme.text.defaultTertiary,
    },
  });
