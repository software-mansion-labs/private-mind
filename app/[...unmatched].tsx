import React from 'react';
import { Redirect } from 'expo-router';

// Expo catches Universal/App Links before Detour
// This redirects to home so Detour SDK can process the link properly
export default function UnmatchedRoute() {
  return <Redirect href="/" />;
}
