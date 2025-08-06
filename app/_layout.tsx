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
              </Stack>
              {Platform.OS === 'android' && <StatusBar style="auto" />}
              <AppToast />
            </BottomSheetModalProvider>
          </KeyboardProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
