import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useDrawer } from '../../context/DrawerContext';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import Menu from '../../assets/icons/menu.svg';

const DrawerToggleButton = () => {
  const { openDrawer } = useDrawer();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity onPress={openDrawer} style={styles.button}>
      <Menu width={16} height={14} style={styles.icon} />
    </TouchableOpacity>
  );
};

export default React.memo(DrawerToggleButton);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: { justifyContent: 'center', alignItems: 'center' },
    icon: {
      color: theme.text.primary,
    },
  });
