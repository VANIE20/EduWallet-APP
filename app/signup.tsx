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
import { signUpWithPinAndOTP, verifyOTP } from '../lib/storage';
import { markDeviceVerified } from './otp-verify';

type Step = 'info' | 'pin' | 'verify';

const COUNTRY_CODES = [
  { code: '+63', flag: '🇵🇭', name: 'PH' },
  { code: '+1',  flag: '🇺🇸', name: 'US' },
  { code: '+44', flag: '🇬🇧', name: 'GB' },
  { code: '+61', flag: '🇦🇺', name: 'AU' },
  { code: '+65', flag: '🇸🇬', name: 'SG' },
  { code: '+81', flag: '🇯🇵', name: 'JP' },
];

export default function SignupScreen() {
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [mobile, setMobile]             = useState('');
  const [countryCode, setCountryCode]   = useState(COUNTRY_CODES[0]);
  const [showCCPicker, setShowCCPicker] = useState(false);
  const [role, setRole]                 = useState<'guardian' | 'student'>('student');
  const [pin, setPin]                   = useState('');
  const [pinConfirm, setPinConfirm]     = useState('');
  const [otp, setOtp]                   = useState('');

  const [step, setStep]                 = useState<Step>('info');
  const [error, setError]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin]           = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);

  const emailRef      = useRef<TextInput>(null);
  const mobileRef     = useRef<TextInput>(null);
  const pinRef        = useRef<TextInput>(null);
  const pinConfirmRef = useRef<TextInput>(null);

  const isValidMobile = (num: string) => /^09\d{9}$/.test(num.replace(/\s/g, ''));

  const handleInfoNext = () => {
    if (!displayName.trim()) { setError('Please enter your full name'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return; }
    if (mobile.trim() && !isValidMobile(mobile)) { setError('Mobile number must start with 09 and be exactly 11 digits'); return; }
    setError('');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('pin');
    setTimeout(() => pinRef.current?.focus(), 100);
  };

  const handlePinNext = async () => {
    if (!/^\d{6}$/.test(pin)) { setError('PIN must be exactly 6 digits'); return; }
    if (pin !== pinConfirm) { setError("PINs don't match"); return; }
    setError('');
    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await signUpWithPinAndOTP(email.trim(), pin, displayName.trim(), role);
    setIsSubmitting(false);
    if (result.success) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('verify');
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || 'Failed to create account');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setError('');
    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await verifyOTP(email.trim(), otp.trim(), role);
    setIsSubmitting(false);
    if (result.success) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await markDeviceVerified();
      router.replace('/link-required');
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || 'Invalid code. Please try again.');
    }
  };

  const handleResendOTP = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOtp(''); setError('');
    setIsSubmitting(true);
    const result = await signUpWithPinAndOTP(email.trim(), pin, displayName.trim(), role);
    setIsSubmitting(false);
    if (!result.success) setError(result.error || 'Failed to resend code');
  };

  const handleBack = () => {
    setError('');
    if (step === 'verify') setStep('pin');
    else if (step === 'pin') setStep('info');
    else router.back();
  };

  const stepTitle: Record<Step, string> = {
    info:   'Create Account',
    pin:    'Set Your PIN',
    verify: 'Verify Email',
  };
  const stepSubtitle: Record<Step, string> = {
    info:   'Join EduWallet today',
    pin:    'Choose a 6-digit PIN to sign in',
    verify: `Code sent to ${email}`,
  };

  const STEPS: Step[] = ['info', 'pin', 'verify'];
  const currentStepIndex = STEPS.indexOf(step);

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
      <View style={styles.decorCircle3} />

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
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </Pressable>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((currentStepIndex + 1) / 3) * 100}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>Step {currentStepIndex + 1} of 3</Text>

          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <Ionicons name="school" size={22} color={Colors.white} />
              <Ionicons name="wallet" size={22} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.appName}>EduWallet</Text>
          <Text style={styles.title}>{stepTitle[step]}</Text>
          <Text style={styles.subtitle}>{stepSubtitle[step]}</Text>
        </Animated.View>

        {/* Form card */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.formCard}>

          {/* STEP 1 */}
          {step === 'info' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={(t) => { setDisplayName(t); setError(''); }}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(''); }}
                    placeholder="Enter your email"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => mobileRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Mobile Number <Text style={styles.optionalTag}>(Optional)</Text>
                </Text>
                <View style={styles.mobileRow}>
                  <Pressable
                    onPress={() => setShowCCPicker(v => !v)}
                    style={styles.ccButton}
                  >
                    <Text style={styles.ccFlag}>{countryCode.flag}</Text>
                    <Text style={styles.ccCode}>{countryCode.code}</Text>
                    <Ionicons name={showCCPicker ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textTertiary} />
                  </Pressable>
                  <View style={[styles.inputRow, styles.mobileInput]}>
                    <Ionicons name="call-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      ref={mobileRef}
                      style={styles.input}
                      value={mobile}
                      onChangeText={(t) => { setMobile(t.replace(/[^0-9]/g, '').slice(0, 11)); setError(''); }}
                      placeholder="09XXXXXXXXX"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={11}
                    />
                  </View>
                </View>
                {showCCPicker && (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.ccDropdown}>
                    {COUNTRY_CODES.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => { setCountryCode(c); setShowCCPicker(false); }}
                        style={[styles.ccOption, countryCode.code === c.code && styles.ccOptionActive]}
                      >
                        <Text style={styles.ccFlag}>{c.flag}</Text>
                        <Text style={styles.ccOptionName}>{c.name}</Text>
                        <Text style={styles.ccOptionCode}>{c.code}</Text>
                        {countryCode.code === c.code && (
                          <Ionicons name="checkmark" size={16} color={Colors.primary} />
                        )}
                      </Pressable>
                    ))}
                  </Animated.View>
                )}
                <Text style={styles.fieldHint}>Used for account recovery and transaction alerts</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>I am a...</Text>
                <View style={styles.roleRow}>
                  <Pressable onPress={() => setRole('student')} style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]}>
                    <View style={[styles.roleIcon, role === 'student' && styles.roleIconActive]}>
                      <Ionicons name="school" size={22} color={role === 'student' ? Colors.white : Colors.primary} />
                    </View>
                    <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>Student</Text>
                    <Text style={[styles.roleDesc, role === 'student' && styles.roleDescActive]}>Manage allowance & goals</Text>
                  </Pressable>
                  <Pressable onPress={() => setRole('guardian')} style={[styles.roleBtn, role === 'guardian' && styles.roleBtnActive]}>
                    <View style={[styles.roleIcon, role === 'guardian' && styles.roleIconActive]}>
                      <Ionicons name="shield-checkmark" size={22} color={role === 'guardian' ? Colors.white : Colors.primary} />
                    </View>
                    <Text style={[styles.roleText, role === 'guardian' && styles.roleTextActive]}>Guardian</Text>
                    <Text style={[styles.roleDesc, role === 'guardian' && styles.roleDescActive]}>Send & monitor spending</Text>
                  </Pressable>
                </View>
              </View>

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable onPress={handleInfoNext} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </Pressable>
            </>
          )}

          {/* STEP 2 */}
          {step === 'pin' && (
            <>
              <View style={styles.hintBox}>
                <Ionicons name="lock-closed" size={22} color={Colors.primary} />
                <Text style={styles.hintText}>
                  Your 6-digit PIN is used every time you sign in. Keep it safe and don't share it with anyone!
                </Text>
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
                    autoFocus={false}
                    returnKeyType="next"
                    onSubmitEditing={() => pinConfirmRef.current?.focus()}
                  />
                  <Pressable onPress={() => setShowPin(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showPin ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm PIN</Text>
                <View style={[styles.inputRow, pinConfirm.length === 6 && pin !== pinConfirm && styles.inputRowError]}>
                  <Ionicons name="keypad-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    ref={pinConfirmRef}
                    style={[styles.input, styles.pinInput]}
                    value={pinConfirm}
                    onChangeText={(t) => { setPinConfirm(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                    placeholder="••••••"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    secureTextEntry={!showPinConfirm}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={handlePinNext}
                  />
                  <Pressable onPress={() => setShowPinConfirm(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showPinConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>
                {pinConfirm.length > 0 && pinConfirm.length === 6 && (
                  <View style={styles.matchRow}>
                    {pin === pinConfirm ? (
                      <><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={[styles.matchText, { color: '#10B981' }]}>PINs match</Text></>
                    ) : (
                      <><Ionicons name="close-circle" size={14} color={Colors.danger} /><Text style={[styles.matchText, { color: Colors.danger }]}>PINs don't match</Text></>
                    )}
                  </View>
                )}
              </View>

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable
                onPress={handlePinNext}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, isSubmitting && styles.disabled]}
              >
                {isSubmitting
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <><Text style={styles.primaryBtnText}>Create Account</Text><Ionicons name="arrow-forward" size={20} color={Colors.white} /></>
                }
              </Pressable>
            </>
          )}

          {/* STEP 3 */}
          {step === 'verify' && (
            <>
              <View style={styles.hintBox}>
                <Ionicons name="mail" size={22} color={Colors.primary} />
                <Text style={styles.hintText}>
                  We sent a 6-digit code to <Text style={styles.hintBold}>{email}</Text>. Check your inbox!
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <View style={styles.otpBoxRow}>
                  {[0,1,2,3,4,5].map(i => (
                    <View key={i} style={[styles.otpBox, otp.length > i && styles.otpBoxFilled, otp.length === i && styles.otpBoxActive]}>
                      <Text style={styles.otpBoxText}>{otp[i] ?? ''}</Text>
                    </View>
                  ))}
                  <TextInput
                    style={styles.otpHiddenInput}
                    value={otp}
                    onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
              </View>

              {error ? <ErrorBanner message={error} /> : null}

              <Pressable
                onPress={handleVerifyOTP}
                disabled={isSubmitting || otp.length < 6}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, (isSubmitting || otp.length < 6) && styles.disabled]}
              >
                {isSubmitting
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <><Ionicons name="checkmark-circle-outline" size={22} color={Colors.white} /><Text style={styles.primaryBtnText}>Verify & Finish</Text></>
                }
              </Pressable>

              <Pressable onPress={handleResendOTP} style={styles.resendBtn}>
                <Text style={styles.resendText}>
                  Didn't receive the code?  <Text style={styles.resendTextBold}>Resend</Text>
                </Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={() => router.replace('/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginTextBold}>Sign In</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.errorRow}>
      <Ionicons name="alert-circle" size={16} color={Colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  decorCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -100 },
  decorCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 100, left: -60 },
  decorCircle3: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', top: 200, left: 30 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 28 },
  backBtn: { position: 'absolute', left: 0, top: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { width: '60%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 6, marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.white },
  progressLabel: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.65)', marginBottom: 20 },
  logoContainer: { width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  logoInner: { flexDirection: 'row', gap: 4 },
  appName: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: 'rgba(255,255,255,0.8)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 30, fontFamily: 'DMSans_700Bold', color: Colors.white, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  formCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 10 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  optionalTag: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, textTransform: 'none', letterSpacing: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border },
  inputRowError: { borderColor: Colors.danger },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 15, fontSize: 16, fontFamily: 'DMSans_400Regular', color: Colors.text },
  pinInput: { fontSize: 20, fontFamily: 'DMSans_700Bold', letterSpacing: 8, textAlign: 'center' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  fieldHint: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 5, marginLeft: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  matchText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  mobileRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  ccButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 15, minWidth: 82 },
  ccFlag: { fontSize: 18 },
  ccCode: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  mobileInput: { flex: 1 },
  ccDropdown: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, marginTop: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5, overflow: 'hidden' },
  ccOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ccOptionActive: { backgroundColor: '#FFF8F0' },
  ccOptionName: { flex: 1, fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.text },
  ccOptionCode: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, backgroundColor: '#F8FAFC', gap: 6 },
  roleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(13,148,136,0.1)', alignItems: 'center', justifyContent: 'center' },
  roleIconActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  roleText: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  roleTextActive: { color: Colors.white },
  roleDesc: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, textAlign: 'center' },
  roleDescActive: { color: 'rgba(255,255,255,0.8)' },
  hintBox: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF8F0', padding: 16, borderRadius: 12, marginBottom: 22, borderWidth: 1, borderColor: '#FDE68A' },
  hintText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, lineHeight: 20 },
  hintBold: { fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  otpBoxRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', position: 'relative' },
  otpBox: { width: 46, height: 56, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: '#FFF8F0' },
  otpBoxActive: { borderColor: Colors.primary, borderWidth: 2 },
  otpBoxText: { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.text },
  otpHiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0, fontSize: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, backgroundColor: Colors.dangerLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  errorText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.danger },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  primaryBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.white },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  resendBtn: { marginTop: 16, alignItems: 'center' },
  resendText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  resendTextBold: { fontFamily: 'DMSans_700Bold', color: Colors.primary },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  loginTextBold: { fontFamily: 'DMSans_700Bold', color: Colors.primary },
});