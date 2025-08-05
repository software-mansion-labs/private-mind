import React from 'react';
import Drawer from 'expo-router/drawer';
import { useWindowDimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import CustomDrawer from '../../components/drawer/CustomDrawer';

const DrawerLayout = () => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        overlayColor: theme.bg.overlay,
        swipeEdgeWidth: width,
        drawerType: 'slide',
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: '',
        }}
      />
      <Drawer.Screen
        name="model-hub"
        options={{
          title: 'Models',
        }}
      />
      <Drawer.Screen
        name="benchmark"
        options={{
          title: 'Benchmark',
        }}
      />
      <Drawer.Screen name="chat/[id]" />
    </Drawer>
  );
};

export default DrawerLayout;
