import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import MoreIcon from '../../assets/icons/more_horizontal.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';

interface Props {
  onPress: () => void;
}

const ChatOptionsHeaderButton = ({ onPress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Chat options"
      testID="chat-options-button"
    >
      <MoreIcon width={20} height={20} color={theme.text.primary} />
    </Pressable>
  );
};

export default ChatOptionsHeaderButton;

const createStyles = () =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    pressed: {
      opacity: 0.6,
    },
  });
