import { Stack } from 'expo-router';
import React from 'react';
import { AppProvider } from '../../lib/AppContext';

export default function StudentLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" />
        <Stack.Screen name="add-goal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="history" />
      </Stack>
    </AppProvider>
  );
}
