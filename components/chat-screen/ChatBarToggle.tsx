import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { SvgComponent } from '../../utils/SvgComponent';
import { Feedback } from '../../utils/Feedback';

interface Props {
  label: string;
  enabled: boolean;
  iconOn: SvgComponent;
  iconOff: SvgComponent;
  onToggle: () => void;
  testID?: string;
}

const ChatBarToggle = ({
  label,
  enabled,
  iconOn: IconOn,
  iconOff: IconOff,
  onToggle,
  testID,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const handlePress = () => {
    if (enabled) {
      Feedback.toggleOff();
    } else {
      Feedback.toggleOn();
    }
    onToggle();
  };

  const Icon = enabled ? IconOn : IconOff;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.toggleButton,
        !enabled && styles.off,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Icon style={{ color: theme.text.onChatBar }} width={20} height={20} />
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
};

export default ChatBarToggle;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    toggleButton: {
      padding: 8,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.text.onChatBar,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      height: 36,
    },
    toggleText: {
      color: theme.text.onChatBar,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
    },
    off: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.7,
    },
  });
