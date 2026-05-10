import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { signInWithPin } from '../lib/storage';
import { useApp } from '../lib/AppContext';
import { markDeviceVerified, shouldRequireOTP } from './otp-verify';
import { Image } from 'react-native';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { refreshData, isLinked, loggedInUser } = useApp();

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pinRef = useRef<TextInput>(null);

  const handleLogin = async () => {
  if (!email.trim()) { setError('Please enter your email'); return; }
  if (!email.includes('@')) { setError('Please enter a valid email'); return; }
  if (!/^\d{6}$/.test(pin)) { setError('PIN must be exactly 6 digits'); return; }

  setError('');
  setIsSubmitting(true);
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const result = await signInWithPin(email.trim(), pin);
  setIsSubmitting(false);

  if (result.user) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Always refresh first, but don't rely on its return value
    await refreshData();

    setTimeout(async () => {
      const needsOTP = await shouldRequireOTP();
      if (needsOTP) {
        router.replace(`/otp-verify?email=${encodeURIComponent(email.trim())}&role=${result.user!.role}`);
        return;
      }

      await markDeviceVerified();

      // Query Supabase using the correct users-table UUID (not auth UUID)
      // user_links stores users.id (table row UUID), not auth.users.id
      const { supabase } = await import('../lib/supabase');
      const authUserId = result.user!.id;

      // Try to find the users-table row UUID (may differ from auth UUID)
      const [byId, byAuthId] = await Promise.all([
        supabase.from('users').select('id').eq('id', authUserId).maybeSingle(),
        supabase.from('users').select('id').eq('auth_user_id', authUserId).maybeSingle(),
      ]);
      const tableId = byId.data?.id ?? byAuthId.data?.id ?? authUserId;

      const { data: linkData, error: linkError } = await supabase
        .from('user_links')
        .select('id')
        .or(`guardian_id.eq.${tableId},student_id.eq.${tableId}`)
        .limit(1);

      const actuallyLinked = !linkError && Array.isArray(linkData) && linkData.length > 0;

      if (!actuallyLinked) {
        router.replace('/link-required');
      } else {
        router.replace(result.user!.role === 'guardian' ? '/guardian' : '/student');
      }
    }, 150);
  } else {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(result.error || 'Invalid email or PIN');
  }
};

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#9B1C1C', '#F59E0B']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <View style={[styles.topBar, { paddingTop: Platform.OS === 'web' ? 20 : insets.top + 8 }]}>
        <Pressable onPress={() => router.push('/changelog')} style={styles.whatsNewBtn}>
          <Ionicons name="megaphone-outline" size={22} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'web' ? 80 : insets.top + 40,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.header}>
          <View>
            <Image 
              source={require('../assets/adaptive-icon.png')} 
              style={{ width: 170, height: 170,}} 
/>            
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your EduWallet</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="Enter your email"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => pinRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PIN</Text>
            <View style={styles.inputRow}>
              <Ionicons name="keypad-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                ref={pinRef}
                style={[styles.input, styles.pinInput]}
                value={pin}
                onChangeText={(t) => { setPin(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                placeholder="••••••"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPin(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </Pressable>

          {error ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, isSubmitting && styles.disabled]}
          >
            {isSubmitting
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <><Ionicons name="log-in-outline" size={22} color={Colors.white} /><Text style={styles.primaryBtnText}>Sign In</Text></>
            }
          </Pressable>

          <Pressable onPress={() => router.push('/signup')} style={styles.signupLink}>
            <Text style={styles.signupText}>
              Don't have an account? <Text style={styles.signupTextBold}>Create one</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  decorCircle1: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -100, right: -100,
  },
  decorCircle2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: 80, left: -70,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingBottom: 36 },
  logoContainer: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 34, fontFamily: 'DMSans_700Bold', color: Colors.white, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.75)' },
  formCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 10,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { marginLeft: 14 },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 16,
    fontSize: 16, fontFamily: 'DMSans_400Regular', color: Colors.text,
  },
  pinInput: { fontSize: 20, fontFamily: 'DMSans_700Bold', letterSpacing: 8, textAlign: 'center' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 16 },
  forgotBtn: { alignItems: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.primary },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
    backgroundColor: Colors.dangerLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.danger },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 },
  signupLink: { marginTop: 20, alignItems: 'center' },
  signupText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  signupTextBold: { fontFamily: 'DMSans_700Bold', color: Colors.primary },
  topBar: { position: 'absolute', top: 0, right: 0, left: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, zIndex: 10 },
  whatsNewBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  whatsNewText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.primary, textAlign: 'center' },
});