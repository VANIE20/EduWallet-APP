import { Stack } from 'expo-router';
import React from 'react';

export default function GuardianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
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
  );
}