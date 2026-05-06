import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { getPendingInvites, acceptInvite, rejectInvite, refreshUserLinkStatus, getLoggedInUser, setLoggedInUser } from '../lib/storage';
import { useApp } from '../lib/AppContext';

export default function PendingInvitesScreen() {
  const insets = useSafeAreaInsets();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Pull context updaters so we can refresh isLinked BEFORE navigating
  const { setLoggedInUser: setContextUser, refreshData } = useApp();

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    setLoading(true);
    const pending = await getPendingInvites();
    setInvites(pending);
    setLoading(false);
  };

  const handleAccept = async (inviteId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessingId(inviteId);

    const result = await acceptInvite(inviteId);
    setProcessingId(null);

    if (result.success) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Re-fetch the logged in user from storage (acceptInvite already updated AsyncStorage)
      // then push the fresh user into AppContext so isLinked becomes true BEFORE we navigate
      const cachedUser = await getLoggedInUser();
      if (cachedUser) {
        const freshUser = await refreshUserLinkStatus(cachedUser);
        setContextUser(freshUser); // update AppContext state immediately
        await refreshData();       // reload wallet/transactions for the newly linked student
      }

      router.replace('/student');
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', result.error || 'Failed to accept invite');
    }
  };

  const handleReject = async (inviteId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProcessingId(inviteId);
    const result = await rejectInvite(inviteId);
    setProcessingId(null);
    if (result.success) {
      loadInvites();
    } else {
      Alert.alert('Error', result.error || 'Failed to reject invite');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.primary }]}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#9B1C1C', '#F59E0B']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Pending Invites</Text>
      </View>

      <View style={styles.content}>
        {invites.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTitle}>No Pending Invites</Text>
            <Text style={styles.emptyText}>
              You don't have any pending guardian invites at the moment.
            </Text>
          </View>
        ) : (
          <FlatList
            data={invites}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(index * 100).duration(400)}
                style={styles.inviteCard}
              >
                <View style={styles.inviteHeader}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
                  </View>
                  <View style={styles.inviteInfo}>
                    <Text style={styles.guardianName}>{item.guardianName}</Text>
                    <Text style={styles.guardianEmail}>{item.guardianEmail}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.inviteMessage}>
                  Wants to link to your account and manage your allowance
                </Text>

                <View style={styles.actionButtons}>
                  <Pressable
                    onPress={() => handleAccept(item.id)}
                    disabled={processingId === item.id}
                    style={({ pressed }) => [
                      styles.acceptBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      processingId === item.id && { opacity: 0.6 },
                    ]}
                  >
                    {processingId === item.id ? (
                      <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                        <Text style={styles.acceptText}>Accept</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => handleReject(item.id)}
                    disabled={processingId === item.id}
                    style={({ pressed }) => [
                      styles.rejectBtn,
                      pressed && { opacity: 0.9 },
                      processingId === item.id && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    <Text style={styles.rejectText}>Decline</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingHorizontal: 24, paddingBottom: 20 },
  backBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerTitle:   { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.white },
  content:       { flex: 1, backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20 },
  listContent:   { paddingHorizontal: 20, paddingBottom: 20 },
  inviteCard:    { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  inviteHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarCircle:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  inviteInfo:    { flex: 1 },
  guardianName:  { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 2 },
  guardianEmail: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  divider:       { height: 1, backgroundColor: Colors.border, marginBottom: 16 },
  inviteMessage: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  acceptBtn:     { flex: 1, backgroundColor: Colors.success, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptText:    { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
  rejectBtn:     { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rejectText:    { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.danger },
  emptyState:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle:    { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.text, marginTop: 20, marginBottom: 8 },
  emptyText:     { fontSize: 15, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});