import React, { ComponentProps, useCallback, useState } from 'react';
import Drawer, { DrawerContentComponentProps } from 'expo-router/drawer';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { HeaderTitle } from 'expo-router/react-navigation';
import {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDisplayCornerRadius } from '../../hooks/useDisplayCornerRadius';
import { Theme } from '../../styles/colors';
import CustomDrawer from '../../components/drawer/CustomDrawer';
import DrawerEntrance from '../../components/drawer/DrawerEntrance';
import DrawerProgressBridge from '../../components/drawer/DrawerProgressBridge';
import DrawerScreenDim from '../../components/drawer/DrawerScreenDim';
import { getDrawerWidth } from '../../constants/drawer-layout';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import WebScrapeSheet from '../../components/bottomSheets/WebScrapeSheet';
import { WEB_SEARCH_ENABLED } from '../../constants/web';
import { useTurnInFlight } from '../../hooks/useTurnInFlight';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';

const DRAWER_BELOW_SCREEN = -1;
const DRAWER_ABOVE_SCREEN = 3;

const renderHeaderTitle = (props: ComponentProps<typeof HeaderTitle>) => (
  <HeaderTitle {...props} maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE} />
);

const DrawerLayout = () => {
  const { width } = useWindowDimensions();
  const { styles, theme } = useThemedStyles(createStyles);
  const turnInFlight = useTurnInFlight();
  const [searching, setSearching] = useState(false);
  const [screenDisplaced, setScreenDisplaced] = useState(false);
  const searchExpansion = useSharedValue(0);
  const drawerProgress = useSharedValue(0);
  const cornerRadius = useDisplayCornerRadius();
  const drawerWidth = getDrawerWidth(width);

  const expandingDrawerStyle = useAnimatedStyle(() => ({
    width: Math.round(
      interpolate(searchExpansion.get(), [0, 1], [drawerWidth, width])
    ),
    zIndex:
      searchExpansion.get() > 0 ? DRAWER_ABOVE_SCREEN : DRAWER_BELOW_SCREEN,
  }));

  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => (
      <>
        <DrawerProgressBridge
          target={drawerProgress}
          onScreenDisplacedChange={setScreenDisplaced}
        />
        <DrawerEntrance>
          <CustomDrawer
            {...props}
            searchExpansion={searchExpansion}
            onSearchingChange={setSearching}
          />
        </DrawerEntrance>
      </>
    ),
    [drawerProgress, searchExpansion]
  );

  return (
    <View style={styles.root}>
      <Drawer
        drawerContent={renderDrawerContent}
        screenOptions={{
          overlayColor: 'transparent',
          sceneStyle: {
            borderRadius: screenDisplaced ? cornerRadius : 0,
            borderCurve: 'continuous',
            overflow: 'hidden',
          },
          swipeEnabled: !turnInFlight && !searching,
          swipeEdgeWidth: width,
          drawerStyle: [
            {
              width: drawerWidth,
              overflow: 'hidden',
              backgroundColor: theme.bg.softPrimary,
            },
            expandingDrawerStyle as ViewStyle,
          ],
          drawerType: 'back',
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
      <DrawerScreenDim
        progress={drawerProgress}
        searchExpansion={searchExpansion}
        drawerWidth={drawerWidth}
        cornerRadius={cornerRadius}
      />
      {WEB_SEARCH_ENABLED && <WebScrapeSheet />}
    </View>
  );
};

export default DrawerLayout;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
  });
