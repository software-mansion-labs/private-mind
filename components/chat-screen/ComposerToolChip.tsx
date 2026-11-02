import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius, stroke } from '../../constants/design-system';
import { Theme, withAlpha } from '../../styles/colors';
import { SvgComponent } from '../../utils/SvgComponent';
import { Feedback } from '../../utils/Feedback';

const CHIP_SIZE = 32;
const ICON_SIZE = 16;
const TINT_ALPHA = 0.12;
const BORDER_ALPHA = 0.24;
const PRESSED_OPACITY = 0.6;

interface Props {
  label: string;
  icon: SvgComponent;
  onTurnOff: () => void;
  testID?: string;
}

const ComposerToolChip = ({ label, icon: Icon, onTurnOff, testID }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const handlePress = () => {
    Feedback.toggleOff();
    onTurnOff();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label} is on. Turn off ${label}`}
      testID={testID}
    >
      <Icon
        width={ICON_SIZE}
        height={ICON_SIZE}
        style={{ color: theme.bg.main }}
      />
    </Pressable>
  );
};

export default ComposerToolChip;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      width: CHIP_SIZE,
      height: CHIP_SIZE,
      flexShrink: 0,
      borderRadius: radius.full,
      borderWidth: stroke.soft,
      borderColor: withAlpha(theme.bg.main, BORDER_ALPHA),
      backgroundColor: withAlpha(theme.bg.main, TINT_ALPHA),
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: PRESSED_OPACITY,
    },
  });
