import React from 'react';
import { Stack } from 'expo-router';

const StacksLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        presentation: 'modal',
      }}
    >
      <Stack.Screen
        name="chat/[id]/settings"
        options={{
          title: 'Chat Settings',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-local-model"
        options={{
          title: 'Add Model',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-remote-model"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit-local-model/[modelId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit-remote-model/[modelId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="app-info"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
};

export default StacksLayout;
