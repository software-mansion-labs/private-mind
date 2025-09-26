import React from 'react';
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
import { Stack } from 'expo-router';
import { VectorStoreProvider } from '../context/VectorStoreContext';
import * as SplashScreen from 'expo-splash-screen';
import SplashScreenAnimation from '../components/SplashScreenAnimation';
import { DetourProvider } from '@swmansion/react-native-detour';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: false, duration: 0 });

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
      <SQLiteProvider databaseName="executorch.db" onInit={initDatabase}>
        <ThemeProvider>
          <DetourProvider
            config={{
              appID: '5221dbb2-5b9f-4734-bc71-b28bec52127f',
              API_KEY:
                '5966a1dcc1a7d9689f9be9495423e365b434911f613e4a437f246ae0c58325e4',
              shouldUseClipboard: false,
            }}
          >
            <VectorStoreProvider>
              <KeyboardProvider>
                <BottomSheetModalProvider>
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
                  </Stack>
                  {Platform.OS === 'android' && <StatusBar style="auto" />}
                  <AppToast />
                </BottomSheetModalProvider>
              </KeyboardProvider>
            </VectorStoreProvider>
            <SplashScreenAnimation />
          </DetourProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
