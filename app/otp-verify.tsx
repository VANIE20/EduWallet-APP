import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_ACTIVE_KEY = 'eduwallet_last_active';
const DEVICE_VERIFIED_KEY = 'eduwallet_device_verified';
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export async function shouldRequireOTP(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const deviceVerified = await AsyncStorage.getItem(DEVICE_VERIFIED_KEY);
    if (!deviceVerified) return true; // new device

    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    if (!lastActiveStr) return true;

    const lastActive = parseInt(lastActiveStr, 10);
    const now = Date.now();
    if (now - lastActive > INACTIVITY_LIMIT_MS) return true; // inactive > 10min

    return false;
  } catch {
    return false;
  }
}

export async function markDeviceVerified() {
  await AsyncStorage.setItem(DEVICE_VERIFIED_KEY, 'true');
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

export async function updateLastActive() {
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

export default function OTPVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { loggedInUser, logoutUser } = useApp();
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Use route params as fallback — loggedInUser may not be loaded yet on fresh login
  const email = loggedInUser?.email || params.email || '';
  const role = loggedInUser?.role || params.role || 'student';

  useEffect(() => {
    if (email) sendOTP();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOTP = async () => {
    if (!email) return;
    setSending(true);
    setError('');
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError('Failed to send OTP. Please try again.');
      } else {
        setSent(true);
        setCountdown(60);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Supabase signInWithOtp sends 'email' type OTP (numeric code)
      // Try 'email' type; if it fails, also try 'magiclink' for compatibility
      const res1 = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      const res2 = res1.error
        ? await supabase.auth.verifyOtp({ email, token: otp, type: 'magiclink' })
        : res1;
      const verifyError = res1.error && res2.error ? res2.error : null;
      if (verifyError) {
        setError('Invalid or expired code. Please try again.');
        setOtp('');
      } else {
        await markDeviceVerified();

        // Do a fresh DB link check — loggedInUser.isLinked may be stale at this point
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const authUserId = authUser?.id;
        let isActuallyLinked = false;

        if (authUserId) {
          const [byId, byAuthId] = await Promise.all([
            supabase.from('users').select('id').eq('id', authUserId).maybeSingle(),
            supabase.from('users').select('id').eq('auth_user_id', authUserId).maybeSingle(),
          ]);
          const tableId = byId.data?.id ?? byAuthId.data?.id ?? authUserId;
          const { data: linkData } = await supabase
            .from('user_links')
            .select('id')
            .or(`guardian_id.eq.${tableId},student_id.eq.${tableId}`)
            .limit(1);
          isActuallyLinked = Array.isArray(linkData) && linkData.length > 0;
        }

        if (!isActuallyLinked) {
          router.replace('/link-required');
        } else {
          router.replace(role === 'guardian' ? '/guardian' : '/student');
        }
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await logoutUser();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#800000', '#F59E0B']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.inner, { paddingTop: Platform.OS === 'web' ? 80 : insets.top + 40 }]}>
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={40} color={Colors.white} />
          </View>
          <Text style={styles.title}>Security Check</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `We sent a 6-digit code to\n${email}`
              : 'Verifying your identity...'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.card}>
          {sending ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.sendingText}>Sending code to your email...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Enter Verification Code</Text>
              <TextInput
                ref={inputRef}
                style={styles.otpInput}
                value={otp}
                onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                placeholder="••••••"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                textAlign="center"
              />

              {error ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              <Pressable
                onPress={verifyOTP}
                disabled={loading || otp.length !== 6}
                style={({ pressed }) => [
                  styles.verifyBtn,
                  (loading || otp.length !== 6) && styles.verifyBtnDisabled,
                  pressed && otp.length === 6 && !loading && { opacity: 0.9 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={sendOTP}
                disabled={countdown > 0 || sending}
                style={styles.resendBtn}
              >
                <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 30, fontFamily: 'DMSans_700Bold',
    color: Colors.white, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 10,
  },
  sendingRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, justifyContent: 'center', paddingVertical: 16,
  },
  sendingText: {
    fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary,
  },
  inputLabel: {
    fontSize: 13, fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  otpInput: {
    backgroundColor: '#F8FAFC', borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    fontSize: 32, fontFamily: 'DMSans_700Bold',
    color: Colors.text, paddingVertical: 18,
    letterSpacing: 12, marginBottom: 16,
  },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16, backgroundColor: Colors.dangerLight,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.danger },
  verifyBtn: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  verifyBtnDisabled: { opacity: 0.4 },
  verifyBtnText: { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
  resendBtn: { marginTop: 16, alignItems: 'center' },
  resendText: {
    fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.primary,
  },
  resendDisabled: { color: Colors.textTertiary },
  logoutBtn: { marginTop: 24, alignItems: 'center' },
  logoutText: {
    fontSize: 14, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.6)',
  },
});