import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/AppContext';

type Step = 'confirm' | 'otp' | 'done';

export default function RemoveStudentScreen() {
  const insets = useSafeAreaInsets();
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName: string }>();
  const { loggedInUser, removeStudent, guardianBalance } = useApp();

  const [step,        setStep]        = useState<Step>('confirm');
  const [otpCode,     setOtpCode]     = useState('');
  const [otpLoading,  setOtpLoading]  = useState(false);
  const [isRemoving,  setIsRemoving]  = useState(false);
  const [error,       setError]       = useState('');

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setOtpLoading(true);
    setError('');
    tap();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || loggedInUser?.email;
      if (!email) throw new Error('No email found on account.');

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (otpErr) throw otpErr;

      setStep('otp');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP.');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Step 2: Verify OTP + Remove ───────────────────────────────────────────
  const handleVerifyAndRemove = async () => {
    if (!otpCode.trim() || otpCode.length < 4) {
      setError('Please enter the OTP sent to your email.');
      return;
    }
    setIsRemoving(true);
    setError('');
    tap();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || loggedInUser?.email;
      if (!email) throw new Error('No email found.');

      // Verify OTP
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'email',
      });
      if (verifyErr) throw new Error('Invalid or expired OTP. Please try again.');

      // Remove the student
      const result = await removeStudent(studentId);
      if (!result.success) throw new Error(result.error || 'Failed to remove student.');

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Failed to remove student.');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpCode('');
    setError('');
    await handleSendOtp();
  };

  const handleDone = () => {
    // Go back to guardian dashboard — AppContext already updated linkedStudents
    router.replace('/guardian');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9B1C1C', '#F59E0B']} style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20,
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
        }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.header}>
          {step !== 'done' && (
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          )}
          <View style={styles.logoContainer}>
            <Ionicons name={step === 'done' ? 'checkmark-circle' : 'person-remove'} size={40} color="#fff" />
          </View>
          <Text style={styles.title}>
            {step === 'confirm' && 'Remove Student'}
            {step === 'otp'     && 'Verify Identity'}
            {step === 'done'    && 'Student Removed'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'confirm' && `Removing ${studentName} from your account`}
            {step === 'otp'     && 'Enter the code sent to your email'}
            {step === 'done'    && `${studentName} has been unlinked`}
          </Text>
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.card}>

          {/* ── Step 1: Confirm ── */}
          {step === 'confirm' && (
            <>
              <Text style={styles.cardTitle}>Are you sure?</Text>

              <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color="#D97706" style={{ marginRight: 10, marginTop: 2 }} />
                <Text style={styles.warningText}>
                  Removing <Text style={{ fontFamily: 'DMSans_700Bold' }}>{studentName}</Text> will unlink them from your account.
                  Their wallet balance and transaction history will be preserved.
                </Text>
              </View>

              <View style={styles.infoList}>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.infoText}>Student's wallet balance is kept</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.infoText}>Transaction history is preserved</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="close-circle" size={16} color={Colors.danger} />
                  <Text style={styles.infoText}>You will stop sending allowances to them</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="close-circle" size={16} color={Colors.danger} />
                  <Text style={styles.infoText}>Spending limits and goals will be unlinked</Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSendOtp}
                disabled={otpLoading}
                style={[styles.primaryBtn, otpLoading && { opacity: 0.6 }]}
              >
                {otpLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Send OTP to Confirm</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSubtitle}>
                A verification code was sent to{' '}
                <Text style={{ fontFamily: 'DMSans_700Bold', color: Colors.text }}>
                  {loggedInUser?.email}
                </Text>
              </Text>

              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={t => { setOtpCode(t); setError(''); }}
                placeholder="Enter OTP"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                autoFocus
                maxLength={8}
              />

              <Pressable onPress={handleResendOtp} disabled={otpLoading} style={styles.resendRow}>
                {otpLoading
                  ? <ActivityIndicator size="small" color="#9B1C1C" />
                  : <Text style={styles.resendText}>Resend OTP</Text>
                }
              </Pressable>

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleVerifyAndRemove}
                disabled={isRemoving}
                style={[styles.dangerBtn, isRemoving && { opacity: 0.6 }]}
              >
                {isRemoving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-remove" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Verify & Remove Student</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => { setStep('confirm'); setOtpCode(''); setError(''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Go Back</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <View style={styles.doneContainer}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
              </View>
              <Text style={styles.doneTitle}>{studentName} Removed</Text>
              <Text style={styles.doneText}>
                {studentName} has been successfully unlinked from your account.
              </Text>

              {guardianBalance > 0 && (
                <View style={styles.balanceHint}>
                  <Ionicons name="wallet" size={16} color="#9B1C1C" />
                  <Text style={styles.balanceHintText}>
                    You still have ₱{guardianBalance.toFixed(2)} in your wallet.
                    You can add a new student or cash it out.
                  </Text>
                </View>
              )}

              <Pressable onPress={handleDone} style={styles.primaryBtn}>
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
              </Pressable>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  decorCircle1:    { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -100 },
  decorCircle2:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 100, left: -60 },
  scrollContent:   { flexGrow: 1, paddingHorizontal: 24 },
  header:          { alignItems: 'center', paddingTop: 20, paddingBottom: 32 },
  backBtn:         { position: 'absolute', left: 0, top: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  logoContainer:   { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:           { fontSize: 28, fontFamily: 'DMSans_700Bold', color: '#fff', marginBottom: 8 },
  subtitle:        { fontSize: 14, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  card:            { backgroundColor: Colors.white, borderRadius: 24, padding: 28, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  cardTitle:       { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 8 },
  cardSubtitle:    { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  warningBox:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginBottom: 20 },
  warningText:     { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#92400E', lineHeight: 20 },
  infoList:        { gap: 10, marginBottom: 24 },
  infoRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText:        { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  errorRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  errorText:       { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.danger, flex: 1 },
  primaryBtn:      { backgroundColor: '#9B1C1C', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  dangerBtn:       { backgroundColor: '#DC2626', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  primaryBtnText:  { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#fff' },
  cancelBtn:       { borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  cancelBtnText:   { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  otpInput:        { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 8, textAlign: 'center', letterSpacing: 4 },
  resendRow:       { alignItems: 'flex-end', marginBottom: 20 },
  resendText:      { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#9B1C1C' },
  doneContainer:   { alignItems: 'center' },
  doneIcon:        { marginBottom: 16 },
  doneTitle:       { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 8 },
  doneText:        { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  balanceHint:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 20, width: '100%' },
  balanceHintText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#92400E', lineHeight: 18 },
});