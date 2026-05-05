import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { supabase } from '../lib/supabase';

type Step = 'enterEmail' | 'enterOtp' | 'success';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('enterEmail');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

  // ── Step 1: Send OTP to email ─────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) return setError('Please enter your email.');
    if (!email.includes('@')) return setError('Please enter a valid email.');

    setError('');
    setIsSubmitting(true);
    tap();

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpError) throw otpError;

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('enterOtp');
    } catch (e: any) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: Verify OTP + set new PIN ─────────────────────────────────────
  const handleVerifyAndReset = async () => {
    if (!otpCode.trim() || otpCode.length < 4) return setError('Please enter the OTP sent to your email.');
    if (!newPin) return setError('Please enter a new PIN.');
    if (!/^\d{6}$/.test(newPin)) return setError('PIN must be exactly 6 digits.');
    if (newPin !== confirmPin) return setError('PINs do not match.');

    setError('');
    setIsSubmitting(true);
    tap();

    try {
      // Verify OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyError) throw new Error('Invalid or expired OTP. Please try again.');

      // Set new PIN as password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPin });
      if (updateError) throw updateError;

      // Flag PIN auth in metadata
      await supabase.auth.updateUser({ data: { uses_pin: true } });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
    } catch (e: any) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || 'Failed to reset PIN. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpCode('');
    setError('');
    setIsSubmitting(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpError) throw otpError;
      Alert.alert('OTP Resent', `A new code was sent to ${email}.`);
    } catch (e: any) {
      setError(e.message || 'Failed to resend OTP.');
    } finally {
      setIsSubmitting(false);
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

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </Pressable>
          <View style={styles.logoContainer}>
            <Ionicons name="keypad" size={40} color={Colors.white} />
          </View>
          <Text style={styles.title}>Forgot PIN</Text>
          <Text style={styles.subtitle}>
            {step === 'enterEmail' && "We'll send a code to your email"}
            {step === 'enterOtp' && 'Enter the code we sent you'}
            {step === 'success' && 'PIN reset successfully!'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formCard}>

          {/* ── Step 1: Enter Email ── */}
          {step === 'enterEmail' && (
            <>
              <Text style={styles.formTitle}>Reset your PIN</Text>
              <Text style={styles.formSubtitle}>
                Enter your account email and we'll send you a one-time code to reset your PIN.
              </Text>

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
                    autoFocus
                  />
                </View>
              </View>

              {error ? (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              <Pressable
                onPress={handleSendOtp}
                disabled={isSubmitting}
                style={[styles.primaryBtn, isSubmitting && { opacity: 0.6 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="mail" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Send OTP Code</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.backLink}>
                <Ionicons name="arrow-back" size={16} color={Colors.textTertiary} />
                <Text style={styles.backText}>Back to Sign In</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 2: Enter OTP + New PIN ── */}
          {step === 'enterOtp' && (
            <>
              <Text style={styles.formTitle}>Enter OTP & New PIN</Text>
              <Text style={styles.formSubtitle}>
                We sent a verification code to{' '}
                <Text style={{ fontFamily: 'DMSans_600SemiBold', color: Colors.text }}>{email}</Text>.
                Enter it below along with your new 6-digit PIN.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code (OTP)</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={otpCode}
                    onChangeText={(t) => { setOtpCode(t); setError(''); }}
                    placeholder="Enter OTP"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={8}
                  />
                </View>
              </View>

              <Pressable onPress={handleResendOtp} disabled={isSubmitting} style={styles.resendRow}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#9B1C1C" />
                ) : (
                  <Text style={styles.resendText}>Resend OTP</Text>
                )}
              </Pressable>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New PIN (6 digits)</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="keypad-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newPin}
                    onChangeText={(v) => { setNewPin(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New PIN</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="keypad-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPin}
                    onChangeText={(v) => { setConfirmPin(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                </View>
              </View>

              {error ? (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              ) : null}

              <Pressable
                onPress={handleVerifyAndReset}
                disabled={isSubmitting}
                style={[styles.primaryBtn, isSubmitting && { opacity: 0.6 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Verify & Reset PIN</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => { setStep('enterEmail'); setError(''); }} style={styles.backLink}>
                <Ionicons name="arrow-back" size={16} color={Colors.textTertiary} />
                <Text style={styles.backText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>PIN Reset!</Text>
              <Text style={styles.successText}>
                Your PIN has been updated successfully. You can now sign in with your new PIN.
              </Text>
              <Pressable onPress={() => router.replace('/login')} style={styles.primaryBtn}>
                <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Back to Sign In</Text>
              </Pressable>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingTop: 20,
    paddingBottom: 32,
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    marginBottom: 28,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: Colors.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: Colors.danger,
  },
  primaryBtn: {
    backgroundColor: '#9B1C1C',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
  backLink: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: Colors.textTertiary,
  },
  resendRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#9B1C1C',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
});