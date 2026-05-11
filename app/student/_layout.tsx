import { Stack } from 'expo-router';
import React from 'react';

export default function StudentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
      <Stack.Screen name="goals" />
      <Stack.Screen name="add-goal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history" />
    </Stack>
  );
}