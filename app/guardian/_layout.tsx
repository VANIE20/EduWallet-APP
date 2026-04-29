import { Stack } from 'expo-router';
import React from 'react';
import { AppProvider } from '../../lib/AppContext';

export default function GuardianLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="deposit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="send" options={{ presentation: 'modal' }} />
        <Stack.Screen name="schedule" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spending-limit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="history" />
        <Stack.Screen name="invite-student" options={{ presentation: 'modal' }} />
        <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" />
        <Stack.Screen name="add-goal" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProvider>
  );
}
