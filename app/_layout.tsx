// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import { AppProvider } from '../lib/AppContext';

export default function RootLayout() {
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
        <Stack.Screen name="profile" />
        <Stack.Screen name="guardian" />
        <Stack.Screen name="student" />
      </Stack>
    </AppProvider>
  );
}