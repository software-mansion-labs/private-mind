import React, { ComponentProps, useCallback, useState } from 'react';
import Drawer, { DrawerContentComponentProps } from 'expo-router/drawer';
import { useWindowDimensions, ViewStyle } from 'react-native';
import { HeaderTitle } from 'expo-router/react-navigation';
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import CustomDrawer from '../../components/drawer/CustomDrawer';
import { getDrawerWidth } from '../../constants/drawer-layout';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import WebScrapeSheet from '../../components/bottomSheets/WebScrapeSheet';
import { WEB_SEARCH_ENABLED } from '../../constants/web';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';

const renderHeaderTitle = (props: ComponentProps<typeof HeaderTitle>) => (
  <HeaderTitle {...props} maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE} />
);

const DrawerLayout = () => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const turnInFlight = useTurnInFlight();
  const [searching, setSearching] = useState(false);
  const searchExpansion = useSharedValue(0);
  const drawerWidth = getDrawerWidth(width);

  const expandingDrawerStyle = useAnimatedStyle(() => ({
    width: Math.round(
      interpolate(searchExpansion.get(), [0, 1], [drawerWidth, width])
    ),
  }));

  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => (
      <CustomDrawer
        {...props}
        searchExpansion={searchExpansion}
        onSearchingChange={setSearching}
      />
    ),
    [searchExpansion]
  );

  return (
    <>
      <Drawer
        drawerContent={renderDrawerContent}
        screenOptions={{
          overlayColor: theme.bg.overlay,
          swipeEnabled: !turnInFlight && !searching,
          swipeEdgeWidth: width,
          drawerStyle: [
            { width: drawerWidth, overflow: 'hidden' },
            expandingDrawerStyle as ViewStyle,
          ],
          drawerType: 'slide',
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.bg.softPrimary,
          },
          headerTitleAlign: 'center',
          headerTitle: renderHeaderTitle,
          headerTitleStyle: {
            color: theme.text.primary,
            fontFamily: fontFamily.medium,
            fontSize: fontSizes.md,
          },
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            title: '',
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Drawer.Screen
          name="model-hub"
          options={{
            title: 'Manage models',
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Drawer.Screen
          name="benchmark"
          options={{
            title: 'Benchmark',
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Drawer.Screen
          name="chat/[id]"
          options={{
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Drawer>
      {WEB_SEARCH_ENABLED && <WebScrapeSheet />}
    </>
  );
};

export default DrawerLayout;
