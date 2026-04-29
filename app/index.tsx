import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/AppContext';

export default function Index() {
  const { role, isLoading, loggedInUser } = useApp();

  useEffect(() => {
    if (isLoading) return;

    if (!loggedInUser) {
      router.replace('/login');
    } else if (role === 'guardian') {
      router.replace('/guardian');
    } else if (role === 'student') {
      router.replace('/student');
    } else {
      router.replace('/login');
    }
  }, [isLoading, role, loggedInUser]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#9B1C1C" />
    </View>
  );
}
