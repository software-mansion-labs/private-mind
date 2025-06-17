import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useDrawer } from '../../context/DrawerContext';
import Menu from '../../assets/icons/menu.svg';
import { useTheme } from '../../context/ThemeContext';

const DrawerToggleButton = () => {
  const { openDrawer } = useDrawer();
  const { theme } = useTheme();

  return (
    <TouchableOpacity onPress={openDrawer} style={styles.button}>
      <Menu width={16} height={14} style={{ color: theme.text.primary }} />
    </TouchableOpacity>
  );
};

export default React.memo(DrawerToggleButton);

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 20,
  },
});
