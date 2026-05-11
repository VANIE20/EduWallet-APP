// app/_layout.tsx
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { AppProvider } from '../lib/AppContext';

async function applyUpdate() {
  // checkForUpdateAsync() is not supported in Expo Go — skip in dev builds
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.error('OTA update error:', e);
  }
}

export default function RootLayout() {
  useEffect(() => {
    applyUpdate();
  }, []);

  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="otp-verify" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="link-required" />
        <Stack.Screen name="pending-invites" />
        <Stack.Screen name="remove-student" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="guardian" />
        <Stack.Screen name="student" />
        <Stack.Screen name="changelog" options={{ presentation: 'modal' }} />
        {/* ── Help Center ── */}
        <Stack.Screen name="help" />
      </Stack>
    </AppProvider>
  );
}