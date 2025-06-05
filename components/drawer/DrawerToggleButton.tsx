import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useDrawer } from '../../context/DrawerContext';
import Menu from '../../assets/icons/menu.svg';

const DrawerToggleButton = () => {
  const { openDrawer } = useDrawer();

  return (
    <TouchableOpacity onPress={openDrawer} style={styles.button}>
      <Menu width={16} height={14} />
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
