import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { showTurnInFlightNotice } from '../../utils/turnInFlightNotice';

const DrawerToggleButton = () => {
  const navigation: DrawerContentComponentProps['navigation'] = useNavigation();
  const { styles } = useThemedStyles(createStyles);
  const turnInFlight = useTurnInFlight();

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
      <Menu
        width={16}
        height={14}
        style={[styles.icon, turnInFlight && styles.iconDimmed]}
      />
    </TouchableOpacity>
  );
};

export default React.memo(DrawerToggleButton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 16,
    },
    icon: {
      color: theme.text.primary,
    },
    iconDimmed: {
      opacity: 0.4,
    },
  });
