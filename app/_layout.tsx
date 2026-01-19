import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SQLiteProvider } from 'expo-sqlite';
import { initDatabase } from '../database/db';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_400Regular_Italic,
  DMSans_500Medium_Italic,
  DMSans_600SemiBold_Italic,
} from '@expo-google-fonts/dm-sans';
import { fontFamily } from '../styles/fontStyles';
import { ThemeProvider } from '../context/ThemeContext';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import AppToast from '../components/AppToast';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { useDetourContext } from '@swmansion/react-native-detour';
import { VectorStoreProvider } from '../context/VectorStoreContext';
import * as SplashScreen from 'expo-splash-screen';
import SplashScreenAnimation from '../components/SplashScreenAnimation';
import { DetourProvider } from '@swmansion/react-native-detour';
import { detourConfig } from '../utils/detourConfig';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: false, duration: 0 });

// Detour SDK integration for demo purposes.
// Only handles navigation for Universal/App links with `/chat/detour-demo` route.
// All other routes are ignored.
function RootNavigator() {
  const { deferredLinkProcessed, route } = useDetourContext();
  const router = useRouter();
  const [navigationHandled, setNavigationHandled] = useState(false);

  // Hide splash screen once Detour processing is complete
  useEffect(() => {
    if (deferredLinkProcessed) {
      SplashScreen.hideAsync();
    }
  }, [deferredLinkProcessed]);

  // Handle Detour demo route
  useEffect(() => {
    if (deferredLinkProcessed && route && !navigationHandled) {
      const isDemoRoute = route.includes('chat/detour-demo');
      if (isDemoRoute) {
        console.log('🎯 Detour Demo: Navigating to demo chat');
        setNavigationHandled(true);
        setTimeout(() => {
          router.push('/(modals)/detour-demo');
        }, 1000);
      }
    }
  }, [deferredLinkProcessed, route, navigationHandled, router]);

  // Wait for Detour to finish processing
  if (!deferredLinkProcessed) {
    return null;
  }

  // Render the main navigation stack
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(drawer)" />
      <Stack.Screen
        name="(modals)/chat/[id]/settings"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/add-local-model"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/add-remote-model"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/edit-local-model/[modelId]"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/edit-remote-model/[modelId]"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/app-info"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="(modals)/select-starting-model"
        options={{
          headerShown: false,
          gestureEnabled: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="(modals)/detour-demo"
        options={{
          headerShown: true,
          headerTitle: 'Detour Route',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

export default function Layout() {
  useFonts({
    [fontFamily.regular]: DMSans_400Regular,
    [fontFamily.medium]: DMSans_500Medium,
    [fontFamily.bold]: DMSans_600SemiBold,
    [fontFamily.regularItalic]: DMSans_400Regular_Italic,
    [fontFamily.mediumItalic]: DMSans_500Medium_Italic,
    [fontFamily.boldItalic]: DMSans_600SemiBold_Italic,
  });

  return (
    <GestureHandlerRootView>
      <DetourProvider config={detourConfig}>
        <SQLiteProvider databaseName="executorch.db" onInit={initDatabase}>
          <ThemeProvider>
            <VectorStoreProvider>
              <KeyboardProvider enabled={true}>
                <BottomSheetModalProvider>
                  <RootNavigator />
                  {Platform.OS === 'android' && <StatusBar style="auto" />}
                  <AppToast />
                </BottomSheetModalProvider>
              </KeyboardProvider>
            </VectorStoreProvider>
            <SplashScreenAnimation />
          </ThemeProvider>
        </SQLiteProvider>
      </DetourProvider>
    </GestureHandlerRootView>
  );
}
