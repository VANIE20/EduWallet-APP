import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getLoggedInUser, setLoggedInUser } from '../lib/storage';
import { useApp } from '../lib/AppContext';
import Colors from '../constants/colors';

type Section = 'main' | 'editName' | 'editEmail' | 'editPhone' | 'editPin';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { loggedInUser, setLoggedInUser: setContextUser, logoutUser } = useApp();

  const [section, setSection] = useState<Section>('main');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // PIN fields
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // OTP for PIN change
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const isGuardian = loggedInUser?.role === 'guardian';
  const accentColor = isGuardian ? Colors.guardianGradientStart : '#9B1C1C';

  useEffect(() => {
    if (loggedInUser) {
      setDisplayName(loggedInUser.displayName || '');
      setEmail(loggedInUser.email || '');
      // Load phone from local user state (already synced from public.users on sign-in)
      if (loggedInUser.phoneNumber) {
        setPhone(loggedInUser.phoneNumber);
      } else {
        // Fallback: check auth metadata for users who set phone before the DB column existed
        supabase.auth.getUser().then(({ data }) => {
          const meta = data?.user?.user_metadata;
          if (meta?.phone) setPhone(meta.phone);
        });
      }
    }
  }, [loggedInUser]);

  const showSuccess = (msg: string) => Alert.alert('Success', msg);
  const showError = (msg: string) => Alert.alert('Error', msg);

  // ── Name ──────────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!displayName.trim()) return showError('Name cannot be empty.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').update({ display_name: displayName.trim() }).eq('id', user.id);
      }
      const stored = await getLoggedInUser();
      if (stored) {
        const updated = { ...stored, displayName: displayName.trim() };
        await setLoggedInUser(updated);
        setContextUser(updated);
      }
      showSuccess('Name updated!');
      setSection('main');
    } catch (e: any) {
      showError(e.message || 'Failed to update name.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email ─────────────────────────────────────────────────────────────────
  const handleSaveEmail = async () => {
    if (!email.trim()) return showError('Email cannot be empty.');

    // Block email change if no phone number is set
    if (!phone.trim()) {
      return Alert.alert(
        'Phone Number Required',
        'You must add a phone number before you can change your email address. This keeps your account secure.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Phone', onPress: () => setSection('editPhone') },
        ]
      );
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      const stored = await getLoggedInUser();
      if (stored) {
        const updated = { ...stored, email: email.trim() };
        await setLoggedInUser(updated);
        setContextUser(updated);
      }
      Alert.alert('Check your inbox', 'A confirmation link was sent to your new email address.');
      setSection('main');
    } catch (e: any) {
      showError(e.message || 'Failed to update email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phone ─────────────────────────────────────────────────────────────────
  const handleSavePhone = async () => {
    setLoading(true);
    try {
      // 1. Save to Supabase Auth metadata (existing behaviour)
      const { error } = await supabase.auth.updateUser({
        data: { phone: phone.trim() },
      });
      if (error) throw error;

      // 2. Also write to public.users so it's queryable and consistent
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ phone_number: phone.trim() })
          .eq('id', authUser.id);
        if (dbError) console.warn('Could not write phone to public.users:', dbError.message);
      }

      // 3. Update AsyncStorage + context so the rest of the app sees it immediately
      const stored = await getLoggedInUser();
      if (stored) {
        const updated = { ...stored, phoneNumber: phone.trim() };
        await setLoggedInUser(updated);
        setContextUser(updated);
      }

      showSuccess('Phone number updated!');
      setSection('main');
    } catch (e: any) {
      showError(e.message || 'Failed to update phone.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
              try {
                await logoutUser();
                router.replace('/login');
              } catch (e: any) {
                showError(e.message || 'Failed to sign out.');
              }
            },
        },
      ]
    );
  };

  // ── PIN – Step 1: Send OTP ────────────────────────────────────────────────
  const handleRequestPinOtp = async () => {
    setOtpLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || loggedInUser?.email;
      if (!userEmail) throw new Error('No email found on account.');

      const { error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      setOtpSent(true);
      Alert.alert('OTP Sent', `A verification code was sent to ${userEmail}. Enter it below to continue.`);
    } catch (e: any) {
      showError(e.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── PIN – Step 2: Verify OTP then save PIN ────────────────────────────────
  const handleVerifyOtpAndSavePin = async () => {
    if (!otpCode.trim() || otpCode.length < 4) return showError('Please enter the OTP sent to your email.');
    if (!newPin) return showError('New PIN cannot be empty.');
    if (!/^\d{4}$/.test(newPin)) return showError('PIN must be exactly 4 digits.');
    if (newPin !== confirmPin) return showError('PINs do not match.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || loggedInUser?.email;
      if (!userEmail) throw new Error('No email found on account.');

      // Verify the OTP
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpCode.trim(),
        type: 'email',
      });
      if (otpError) throw new Error('Invalid or expired OTP. Please try again.');

      // Save PIN as the account password
      const { error: pinError } = await supabase.auth.updateUser({ password: newPin });
      if (pinError) throw pinError;

      // Flag in metadata so the app knows PIN auth is used
      await supabase.auth.updateUser({ data: { uses_pin: true } });

      setNewPin('');
      setConfirmPin('');
      setOtpCode('');
      setOtpSent(false);
      showSuccess('PIN updated successfully!');
      setSection('main');
    } catch (e: any) {
      showError(e.message || 'Failed to update PIN.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render: Main ───────────────────────────────────────────────────────────
  const renderMain = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.avatarContainer, { backgroundColor: accentColor + '20' }]}>
        <View style={[styles.avatar, { backgroundColor: accentColor }]}>
          <Text style={styles.avatarText}>
            {(loggedInUser?.displayName || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{loggedInUser?.displayName || 'User'}</Text>
        <Text style={styles.profileRole}>{isGuardian ? 'Guardian' : 'Student'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>

        <Pressable style={styles.row} onPress={() => setSection('editName')}>
          <View style={[styles.rowIcon, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="person-outline" size={18} color="#9B1C1C" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Display Name</Text>
            <Text style={styles.rowValue}>{loggedInUser?.displayName || '—'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => setSection('editEmail')}>
          <View style={[styles.rowIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="mail-outline" size={18} color="#D97706" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{loggedInUser?.email || '—'}</Text>
          </View>
          <View style={styles.rowTrailing}>
            {!phone.trim() && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={11} color="#D97706" />
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </View>
        </Pressable>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => setSection('editPhone')}>
          <View style={[styles.rowIcon, { backgroundColor: '#FFF7ED' }]}>
            <Ionicons name="call-outline" size={18} color="#10B981" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Phone Number</Text>
            <Text style={styles.rowValue}>{phone || 'Not set'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.row}
          onPress={() => {
            setOtpSent(false);
            setOtpCode('');
            setNewPin('');
            setConfirmPin('');
            setSection('editPin');
          }}
        >
          <View style={[styles.rowIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="keypad-outline" size={18} color="#EF4444" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>PIN</Text>
            <Text style={styles.rowValue}>••••</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LINKED</Text>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="link-outline" size={18} color="#0284C7" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Status</Text>
            <Text style={[styles.rowValue, { color: loggedInUser?.isLinked ? '#10B981' : Colors.textTertiary }]}>
              {loggedInUser?.isLinked ? 'Linked' : 'Not linked'}
            </Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Render: Edit Name ──────────────────────────────────────────────────────
  const renderEditName = () => (
    <View style={styles.editContainer}>
      <Text style={styles.editTitle}>Change Display Name</Text>
      <Text style={styles.editSubtitle}>This is how you appear in the app.</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSaveName}
      />
      <Pressable
        style={[styles.saveBtn, { backgroundColor: accentColor }, loading && styles.btnDisabled]}
        onPress={handleSaveName}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Name</Text>}
      </Pressable>
    </View>
  );

  // ── Render: Edit Email ─────────────────────────────────────────────────────
  const renderEditEmail = () => (
    <View style={styles.editContainer}>
      <Text style={styles.editTitle}>Change Email</Text>
      <Text style={styles.editSubtitle}>A confirmation link will be sent to your new email.</Text>

      {!phone.trim() && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
          <Text style={styles.warningText}>
            You need a phone number on your account before you can change your email.{' '}
            <Text style={styles.warningLink} onPress={() => setSection('editPhone')}>
              Add phone →
            </Text>
          </Text>
        </View>
      )}

      <TextInput
        style={[styles.input, !phone.trim() && styles.inputDisabled]}
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus={!!phone.trim()}
        editable={!!phone.trim()}
      />
      <Pressable
        style={[
          styles.saveBtn,
          { backgroundColor: !phone.trim() ? Colors.textTertiary : accentColor },
          (loading || !phone.trim()) && styles.btnDisabled,
        ]}
        onPress={handleSaveEmail}
        disabled={loading || !phone.trim()}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Email</Text>}
      </Pressable>
    </View>
  );

  // ── Render: Edit Phone ─────────────────────────────────────────────────────
  const renderEditPhone = () => (
    <View style={styles.editContainer}>
      <Text style={styles.editTitle}>Phone Number</Text>
      <Text style={styles.editSubtitle}>
        Required to change your email and for account recovery.
      </Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+63 9XX XXX XXXX"
        keyboardType="phone-pad"
        autoFocus
      />
      <Pressable
        style={[styles.saveBtn, { backgroundColor: accentColor }, loading && styles.btnDisabled]}
        onPress={handleSavePhone}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Number</Text>}
      </Pressable>
    </View>
  );

  // ── Render: Change PIN (OTP flow) ──────────────────────────────────────────
  const renderEditPin = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.editContainer}>
      <Text style={styles.editTitle}>Change PIN</Text>
      <Text style={styles.editSubtitle}>
        {otpSent
          ? 'Enter the OTP sent to your email, then set your new 4-digit PIN.'
          : "We'll send a one-time code to your email to confirm it's you."}
      </Text>

      {!otpSent ? (
        /* Step 1 – request OTP */
        <Pressable
          style={[styles.saveBtn, { backgroundColor: accentColor }, otpLoading && styles.btnDisabled]}
          onPress={handleRequestPinOtp}
          disabled={otpLoading}
        >
          {otpLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="mail-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Send OTP to Email</Text>
            </View>
          )}
        </Pressable>
      ) : (
        /* Step 2 – enter OTP + new PIN */
        <>
          <Text style={styles.inputLabel}>Verification Code (OTP)</Text>
          <TextInput
            style={styles.input}
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="Enter OTP"
            keyboardType="number-pad"
            autoFocus
            maxLength={8}
          />

          <Pressable onPress={handleRequestPinOtp} disabled={otpLoading} style={styles.resendRow}>
            {otpLoading ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Text style={[styles.resendText, { color: accentColor }]}>Resend OTP</Text>
            )}
          </Pressable>

          <Text style={[styles.inputLabel, { marginTop: 4 }]}>New PIN (4 digits)</Text>
          <TextInput
            style={styles.input}
            value={newPin}
            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />

          <Text style={styles.inputLabel}>Confirm PIN</Text>
          <TextInput
            style={styles.input}
            value={confirmPin}
            onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />

          <Pressable
            style={[styles.saveBtn, { backgroundColor: accentColor }, loading && styles.btnDisabled]}
            onPress={handleVerifyOtpAndSavePin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Verify & Update PIN</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );

  const titles: Record<Section, string> = {
    main: 'My Profile',
    editName: 'Edit Name',
    editEmail: 'Edit Email',
    editPhone: 'Edit Phone',
    editPin: 'Change PIN',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 20 : insets.top + 8 }]}>
        <Pressable
          onPress={() => (section === 'main' ? router.back() : setSection('main'))}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{titles[section]}</Text>
        <View style={{ width: 40 }} />
      </View>

      {section === 'main' && renderMain()}
      {section === 'editName' && renderEditName()}
      {section === 'editEmail' && renderEditEmail()}
      {section === 'editPhone' && renderEditPhone()}
      {section === 'editPin' && renderEditPin()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 34,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
  },
  profileRole: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 3,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 64,
  },
  editContainer: {
    padding: 24,
  },
  editTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    marginBottom: 6,
  },
  editSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: Colors.text,
    marginBottom: 16,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.background,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  resendText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#92400E',
    lineHeight: 19,
  },
  warningLink: {
    fontFamily: 'DMSans_600SemiBold',
    color: '#D97706',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EF4444',
  },
});