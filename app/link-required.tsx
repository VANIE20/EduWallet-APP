import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { getLoggedInUser, getPendingInvites, signOut, refreshUserLinkStatus, type LoggedInUser, type PendingInvite } from '../lib/storage';

export default function LinkRequiredScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const cachedUser = await getLoggedInUser();
      if (!cachedUser) {
        router.replace('/login');
        return;
      }

      // Always re-fetch link status from Supabase — don't trust AsyncStorage
      const currentUser = await refreshUserLinkStatus(cachedUser);
      setUser(currentUser);

      // If already linked, go straight to dashboard
      if (currentUser.isLinked) {
        router.replace(currentUser.role === 'guardian' ? '/guardian' : '/student');
        return;
      }

      if (currentUser.role === 'student') {
        const pending = await getPendingInvites();
        setInvites(pending || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await signOut();
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLoading(true);
    await loadData(); // loadData now handles redirect if already linked
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={['#9B1C1C', '#F59E0B']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <ActivityIndicator size="large" color={Colors.white} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={['#9B1C1C', '#F59E0B']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Ionicons name="alert-circle" size={48} color={Colors.white} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleRefresh} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
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

      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'web' ? 67 : insets.top + 40,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="link" size={48} color={Colors.white} />
          </View>
          <Text style={styles.title}>
            {user?.role === 'guardian' ? 'Link a Student' : 'Waiting for Link'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.role === 'guardian' 
              ? 'Connect with a student account to continue'
              : 'A guardian needs to link to your account'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.card}>
          {user?.role === 'guardian' ? (
            <>
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={24} color={Colors.primary} />
                <Text style={styles.infoText}>
                  You need to link at least one student account to access the app features.
                </Text>
              </View>

              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>How to link:</Text>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Make sure your student has created their account
                  </Text>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Send them an invite using their email
                  </Text>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    They accept the invite in their app
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push('/guardian/invite-student' as any);
                }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="person-add" size={22} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Send Student Invite</Text>
              </Pressable>
            </>
          ) : (
            <>
              {invites.length > 0 ? (
                <>
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                    <Text style={styles.successText}>
                      You have {invites.length} pending invite{invites.length > 1 ? 's' : ''}!
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      router.push('/pending-invites' as any);
                    }}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons name="mail-open" size={22} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>
                      View Invites ({invites.length})
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.infoBox}>
                    <Ionicons name="time" size={24} color={Colors.primary} />
                    <Text style={styles.infoText}>
                      Ask your guardian to send you an invite to link your accounts.
                    </Text>
                  </View>

                  <View style={styles.steps}>
                    <Text style={styles.stepsTitle}>What to do:</Text>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Ask your guardian to create their account
                      </Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Give them your email: <Text style={styles.emailText}>{user?.email || 'your email'}</Text>
                      </Text>
                    </View>
                    <View style={styles.step}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>
                        They'll send you an invite that appears here
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={handleRefresh}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                    <Text style={styles.secondaryBtnText}>Check for Invites</Text>
                  </Pressable>
                </>
              )}
            </>
          )}

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: Colors.white,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: Colors.white,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  retryBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.primary,
  },
  decorCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    right: -100,
  },
  decorCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 100,
    left: -60,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#E0F2FE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  successBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FDE68A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.success,
  },
  steps: {
    marginBottom: 24,
  },
  stepsTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emailText: {
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.primary,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
  secondaryBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.primary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.danger,
  },
});
