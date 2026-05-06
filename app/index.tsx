import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/AppContext';

export default function Index() {
  const { role, isLoading, loggedInUser, isLinked } = useApp();

  useEffect(() => {
    if (isLoading) return;

    if (!loggedInUser) {
      router.replace('/login');
      return;
    }

    // isLinked is set by refreshUserLinkStatus which runs on auth state change.
    // Route to dashboard if linked, otherwise link-required screen.
    if (isLinked) {
      if (role === 'guardian') {
        router.replace('/guardian');
      } else if (role === 'student') {
        router.replace('/student');
      }
    } else {
      router.replace('/link-required');
    }
  }, [isLoading, role, loggedInUser, isLinked]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#9B1C1C" />
    </View>
  );
}