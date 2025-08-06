import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import Menu from '../../assets/icons/menu.svg';
import { useNavigation } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';

const DrawerToggleButton = () => {
  const { theme } = useTheme();
  const navigation: DrawerContentComponentProps['navigation'] = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={() => navigation.openDrawer()}
      style={styles.button}
    >
      <Menu width={16} height={14} style={styles.icon} />
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
  });
