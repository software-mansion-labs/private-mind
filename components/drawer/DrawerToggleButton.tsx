import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { pressedOpacity } from '../../styles/pressable';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { useSteadyFlag } from '../../hooks/useSteadyFlag';
import { showTurnInFlightNotice } from '../../utils/turnInFlightNotice';
import { TURN_IN_FLIGHT_HOLD_MS } from '../../constants/header-actions';
import HeaderActionIcon from '../HeaderActionIcon';

const DrawerToggleButton = () => {
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

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && pressedOpacity]}
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
    </Pressable>
  );
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
