import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
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

  return (
    <TouchableOpacity
      onPress={() => {
        if (turnInFlight) {
          showTurnInFlightNotice();
          return;
        }
        navigation.openDrawer();
      }}
      style={styles.button}
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
};

export default React.memo(DrawerToggleButton);

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 16,
    },
  });
