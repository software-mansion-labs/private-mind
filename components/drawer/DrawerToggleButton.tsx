import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from 'expo-router/drawer';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { useSteadyFlag } from '../../hooks/useSteadyFlag';
import { showTurnInFlightNotice } from '../../utils/turnInFlightNotice';
import { TURN_IN_FLIGHT_HOLD_MS } from '../../constants/header-actions';
import HeaderActionIcon from '../HeaderActionIcon';
import HeaderGlassButton, { headerGlassButtonFill } from '../HeaderGlassButton';

interface Props {
  glass?: boolean;
}

const DrawerToggleButton = ({ glass = false }: Props) => {
  const navigation: DrawerContentComponentProps['navigation'] = useNavigation();
  const { styles, theme } = useThemedStyles(createStyles);
  const turnInFlight = useTurnInFlight();
  const looksBusy = useSteadyFlag(turnInFlight, TURN_IN_FLIGHT_HOLD_MS);

  const handlePress = () => {
    if (turnInFlight) {
      showTurnInFlightNotice();
      return;
    }
    navigation.openDrawer();
  };

  const button = (
    <TouchableOpacity
      onPress={handlePress}
      style={glass ? headerGlassButtonFill : styles.button}
      hitSlop={15}
      testID="drawer-toggle"
    >
      <HeaderActionIcon
        icon={Menu}
        width={16}
        height={14}
        color={theme.text.primary}
        dimmed={looksBusy}
      />
    </TouchableOpacity>
  );

  if (!glass) return button;

  return <HeaderGlassButton edge="leading">{button}</HeaderGlassButton>;
};

export default React.memo(DrawerToggleButton);

const createStyles = () =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 16,
    },
  });
