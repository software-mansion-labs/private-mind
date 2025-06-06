import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import CustomDrawerLayout from '../components/drawer/CustomDrawerLayout';
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
import { fontFamily } from '../styles/fontFamily';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

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
          <BottomSheetModalProvider>
            <CustomDrawerLayout>
              <SafeAreaView style={{ flex: 1 }}>
                <Stack
                  screenOptions={{
                    headerShadowVisible: false,
                  }}
                >
                  <Stack.Screen
                    name="model-hub"
                    options={{ title: 'Models' }}
                  />
                  <Stack.Screen
                    name="index"
                    options={{ title: '', animation: 'none' }}
                  />
                  <Stack.Screen
                    name="benchmark"
                    options={{ title: 'Benchmark' }}
                  />
                  <Stack.Screen
                    name="chat/[id]"
                    options={{ animation: 'none' }}
                  />
                  <Stack.Screen
                    name="chat/[id]/settings"
                    options={{
                      title: 'Chat Settings',
                      presentation: 'modal',
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="modal/add-model"
                    options={{
                      presentation: 'modal',
                      title: 'Add Model',
                      headerShown: false,
                    }}
                  />
                </Stack>
              </SafeAreaView>
            </CustomDrawerLayout>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
