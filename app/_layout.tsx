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
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="otp-verify" options={{ gestureEnabled: false }} />
        <Stack.Screen name="forgot-password" options={{ gestureEnabled: false }} />
        <Stack.Screen name="link-required" options={{ gestureEnabled: false }} />
        <Stack.Screen name="pending-invites" options={{ gestureEnabled: false }} />
        <Stack.Screen name="remove-student" options={{ gestureEnabled: false }} />
        <Stack.Screen name="profile" options={{ gestureEnabled: false }} />
        <Stack.Screen name="guardian" options={{ gestureEnabled: false }} />
        <Stack.Screen name="student" options={{ gestureEnabled: false }} />
        <Stack.Screen name="changelog" options={{ presentation: 'modal' }} />
        {/* ── Help Center ── */}
        <Stack.Screen name="help" />
      </Stack>
    </AppProvider>
  );
}