import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../lib/AppContext';

export default function Index() {
  const { isLoading, loggedInUser, role } = useApp();

  useEffect(() => {
    if (isLoading) return;

    if (!loggedInUser) {
      router.replace('/login');
    } else if (role === 'guardian') {
      router.replace('/guardian');
    } else {
      router.replace('/student');
    }
  }, [isLoading, loggedInUser, role]);

  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color="#C84B00" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F2' },
});