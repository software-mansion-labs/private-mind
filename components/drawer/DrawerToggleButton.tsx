import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { pressedOpacity } from '../../styles/pressable';

const DrawerToggleButton = () => {
  const navigation: DrawerContentComponentProps['navigation'] = useNavigation();
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={() => navigation.openDrawer()}
      style={({ pressed }) => [styles.button, pressed && pressedOpacity]}
      hitSlop={15}
    >
      <Menu width={16} height={14} style={styles.icon} />
    </Pressable>
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
  });
