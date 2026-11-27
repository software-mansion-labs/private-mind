import React from 'react';
import { Stack } from 'expo-router';

const SettingsLayout = () => (
  <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right' }} />
);

export default SettingsLayout;
