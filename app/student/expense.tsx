import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, KeyboardAvoidingView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';

// ── Categories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'food',          label: 'Food',      icon: 'fast-food',           color: '#F97316', bg: '#FFF7ED' },
  { id: 'transport',     label: 'Transport', icon: 'bus',                 color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'entertainment', label: 'Fun',       icon: 'game-controller',     color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'school',        label: 'School',    icon: 'book',                color: '#800000', bg: '#F0FDFA' },
  { id: 'other',         label: 'Other',     icon: 'ellipsis-horizontal', color: '#6B7280', bg: '#F9FAFB' },
];

// ── E-wallet payout methods ─────────────────────────────────────────────────
type EWalletMethod = 'gcash' | 'maya' | 'card';

interface EWalletOption {
  id: EWalletMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  gradient: string;
  accountLabel: string;
  placeholder: string;
}

const EWALLET_OPTIONS: EWalletOption[] = [
  {
    id: 'gcash', label: 'GCash', icon: 'phone-portrait-outline',
    color: '#007AFF', bg: '#EFF6FF', gradient: '#DBEAFE',
    accountLabel: 'GCash Mobile Number', placeholder: '09XX XXX XXXX',
  },
  {
    id: 'maya', label: 'Maya', icon: 'wallet-outline',
    color: '#16A34A', bg: '#DCFCE7', gradient: '#BBF7D0',
    accountLabel: 'Maya Mobile Number', placeholder: '09XX XXX XXXX',
  },
  {
    id: 'card', label: 'Bank / Card', icon: 'card-outline',
    color: '#7C3AED', bg: '#EDE9FE', gradient: '#DDD6FE',
    accountLabel: 'Account Number', placeholder: 'XXXX XXXX XXXX XXXX',
  },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

function formatCurrency(amount: number): string {
  return '\u20b1' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const tap = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ── Screen ──────────────────────────────────────────────────────────────────
export default function ExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { studentBalance, spendingLimit, todaySpent, addExpense, refreshData } = useApp();

  const [amount, setAmount]             = useState('');
  const [description, setDescription]   = useState('');
  const [category, setCategory]         = useState('food');
  const [isSubmitting, setSubmitting]   = useState(false);

  // E-wallet payout state (always required)
  const [eMethod, setEMethod]     = useState<EWalletMethod>('gcash');
  const [accountNo, setAccountNo] = useState('');

  const parsedAmount = parseFloat(amount) || 0;
  const selMethod    = EWALLET_OPTIONS.find(o => o.id === eMethod)!;
  const hasEnough    = parsedAmount <= studentBalance;

  // Spending limit
  const hasSpendingLimit = spendingLimit && spendingLimit.isActive && spendingLimit.dailyLimit > 0;
  const limitRemaining   = hasSpendingLimit ? Math.max(spendingLimit!.dailyLimit - todaySpent, 0) : null;
  const wouldExceedLimit = hasSpendingLimit && (todaySpent + parsedAmount > spendingLimit!.dailyLimit);

  // Mobile number validation: must start with 09, exactly 11 digits
  const isMobileMethod = eMethod === 'gcash' || eMethod === 'maya';
  const cleanAccount   = accountNo.replace(/\s/g, '');
  const isValidAccount = isMobileMethod
    ? /^09\d{9}$/.test(cleanAccount)   // 09 + 9 digits = 11 total
    : cleanAccount.length >= 6;         // card: reasonable length

  const mobileError = isMobileMethod && accountNo.length > 0 && !isValidAccount
    ? !cleanAccount.startsWith('09')
      ? 'Mobile number must start with 09'
      : `Must be exactly 11 digits (${cleanAccount.length}/11)`
    : '';

  // Sanitize amount: prevent multiple decimal points
  const handleAmountChange = (text: string) => {
    let sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    setAmount(sanitized);
  };

  // Account number handler: for mobile methods enforce digits only, max 11
  const handleAccountChange = (text: string) => {
    if (isMobileMethod) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, 11);
      setAccountNo(digits);
    } else {
      setAccountNo(text.replace(/[^0-9]/g, '').slice(0, 19));
    }
  };

  const isValid =
    parsedAmount > 0 &&
    hasEnough &&
    isValidAccount &&
    !wouldExceedLimit;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    tap();

    Alert.alert(
      'Confirm Expense',
      `Log ${formatCurrency(parsedAmount)} via ${selMethod.label} (${accountNo})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              const desc = description.trim()
                ? `${description.trim()} · Payout via ${selMethod.label} to ${accountNo}`
                : `Payout via ${selMethod.label} to ${accountNo}`;

              const success = await addExpense(
                parsedAmount,
                desc,
                category,
              );

              if (!success) {
                if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert(
                  'Expense Blocked',
                  'This expense would exceed your daily spending limit set by your guardian.',
                  [{ text: 'OK' }],
                );
                return;
              }

              await refreshData();
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                '\u2705 Expense Logged!',
                `${formatCurrency(parsedAmount)} has been recorded.\nPayout via ${selMethod.label} will be processed to ${accountNo}.`,
                [{ text: 'Done', onPress: () => router.back() }],
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [isValid, parsedAmount, selMethod, accountNo, description, category, addExpense, refreshData]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Balance */}
        <View style={styles.balanceInfo}>
          <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.balanceText}>Balance: {formatCurrency(studentBalance)}</Text>
        </View>

        {/* Spending limit banner */}
        {hasSpendingLimit && (
          <View style={[styles.limitInfo, limitRemaining === 0 && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
            <Ionicons name="shield-checkmark" size={16} color={limitRemaining === 0 ? Colors.danger : '#D97706'} />
            <Text style={[styles.limitText, limitRemaining === 0 && { color: Colors.danger }]}>
              {limitRemaining === 0 ? 'Daily limit reached' : 'Daily limit: ' + formatCurrency(limitRemaining!) + ' remaining'}
            </Text>
          </View>
        )}

        {/* Amount input */}
        <View style={styles.amountSection}>
          <Text style={[styles.currencySign, parsedAmount > 0 && styles.currencySignActive]}></Text>
          <TextInput
            style={[styles.amountInput, parsedAmount > 0 && styles.amountInputActive]}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.0"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
            editable={!isSubmitting}
          />
        </View>

        {/* Amount errors */}
        {parsedAmount > 0 && parsedAmount > studentBalance && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>Not enough balance</Text>
          </View>
        )}
        {parsedAmount > 0 && hasEnough && wouldExceedLimit && (
          <View style={styles.errorRow}>
            <Ionicons name="shield" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>Exceeds daily spending limit ({formatCurrency(limitRemaining!)} left)</Text>
          </View>
        )}

        {/* Quick amounts */}
        <Text style={styles.sectionLabel}>Quick Select</Text>
        <View style={styles.quickGrid}>
          {QUICK_AMOUNTS.map((val) => {
            const sel  = amount === val.toString();
            const over = val > studentBalance;
            return (
              <Pressable
                key={val}
                onPress={() => { tap(); setAmount(val.toString()); }}
                disabled={isSubmitting || over}
                style={({ pressed }) => [
                  styles.quickBtn,
                  sel  && styles.quickBtnActive,
                  over && styles.quickBtnDisabled,
                  pressed && !over && { opacity: 0.7 },
                ]}
              >
                {sel && <View style={styles.quickCheck}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
                <Text style={[styles.quickText, sel && styles.quickTextActive, over && styles.quickTextDisabled]}>
                  {'\u20b1'}{val >= 1000 ? val / 1000 + 'k' : val}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What did you spend on? <Text style={styles.optionalLabel}>(optional)</Text></Text>
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Lunch at school cafeteria"
            placeholderTextColor={Colors.textTertiary}
            maxLength={100}
            editable={!isSubmitting}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => { tap(); setCategory(cat.id); }}
                style={[styles.catBtn, category === cat.id && { borderColor: cat.color, borderWidth: 2 }]}
              >
                <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={[styles.catText, category === cat.id && { color: cat.color, fontFamily: 'DMSans_700Bold' }]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── E-Wallet Payout ── */}
        <View style={styles.ewalletSection}>
          <View style={styles.ewalletHeader}>
            <Ionicons name="phone-portrait-outline" size={16} color={selMethod.color} />
            <Text style={[styles.ewalletTitle, { color: selMethod.color }]}>Payout via E-Wallet</Text>
          </View>
          <Text style={styles.ewalletSubtitle}>Select where your payout will be sent</Text>

          {/* Method selector */}
          <View style={styles.methodGrid}>
            {EWALLET_OPTIONS.map((opt) => {
              const sel = eMethod === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => { tap(); setEMethod(opt.id); setAccountNo(''); }}
                  disabled={isSubmitting}
                  style={[styles.methodCard, sel && { borderColor: opt.color, backgroundColor: opt.bg }]}
                >
                  <View style={[styles.methodIconWrap, { backgroundColor: sel ? opt.gradient : '#F1F5F9' }]}>
                    <Ionicons name={opt.icon} size={22} color={sel ? opt.color : '#94A3B8'} />
                  </View>
                  <Text style={[styles.methodLabel, sel && { color: opt.color }]}>{opt.label}</Text>
                  {sel && (
                    <View style={[styles.methodCheck, { backgroundColor: opt.color }]}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Account number input */}
          <Text style={styles.sectionLabel}>{selMethod.accountLabel}</Text>
          <View style={[styles.accountInputWrap, { borderColor: isValidAccount ? selMethod.color : (accountNo.length > 0 ? '#EF4444' : '#E2E8F0') }]}>
            <Ionicons
              name={selMethod.icon}
              size={18}
              color={isValidAccount ? selMethod.color : (accountNo.length > 0 ? '#EF4444' : '#94A3B8')}
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.accountInput}
              value={accountNo}
              onChangeText={handleAccountChange}
              placeholder={selMethod.placeholder}
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              editable={!isSubmitting}
              maxLength={isMobileMethod ? 11 : 19}
            />
          </View>
          {mobileError ? (
            <View style={styles.mobileErrorRow}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.mobileErrorText}>{mobileError}</Text>
            </View>
          ) : null}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Ionicons name="information-circle-outline" size={18} color="#0EA5E9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>E-Wallet Payout</Text>
              <Text style={styles.infoBannerBody}>
                Payout is recorded with your expense. Actual transfers are processed manually by your school.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        {isValid && !isSubmitting && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payout via {selMethod.label}</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(parsedAmount)}</Text>
          </View>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            styles.submitBtn,
            isValid && !isSubmitting && { backgroundColor: selMethod.color },
            (!isValid || isSubmitting) && styles.submitBtnDisabled,
            pressed && isValid && { opacity: 0.9 },
          ]}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitBtnText}>Processing\u2026</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitBtnText}>
                {isValid
                  ? 'Log Expense ' + formatCurrency(parsedAmount)
                  : (!hasEnough && parsedAmount > 0
                      ? 'Insufficient Balance'
                      : 'Enter amount & account')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  scrollView:         { flex: 1 },
  content:            { paddingHorizontal: 24, paddingBottom: 140 },

  balanceInfo:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Colors.surfaceAlt, borderRadius: 12, marginBottom: 8 },
  balanceText:        { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.textSecondary },

  limitInfo:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#FEF3C7', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  limitText:          { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#92400E' },

  amountSection:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  currencySign:       { fontSize: 36, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', marginRight: 4, marginTop: 6 },
  currencySignActive: { color: Colors.text },
  amountInput:        { fontSize: 52, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', minWidth: 80, textAlign: 'center' },
  amountInputActive:  { color: Colors.text },

  errorRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  errorText:          { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.danger },

  section:            { marginBottom: 20 },
  sectionLabel:       { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  optionalLabel:      { fontSize: 10, fontFamily: 'DMSans_400Regular', color: '#CBD5E1', textTransform: 'none', letterSpacing: 0 },
  descInput:          { backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, fontFamily: 'DMSans_400Regular', color: Colors.text },
  catGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catBtn:             { backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, minWidth: '30%' as any, flex: 1 },
  catIcon:            { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catText:            { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.text },

  quickGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  quickBtn:           { width: '30.5%' as any, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', position: 'relative' },
  quickBtnActive:     { backgroundColor: Colors.text, borderColor: Colors.text },
  quickBtnDisabled:   { opacity: 0.35 },
  quickText:          { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  quickTextActive:    { color: '#fff' },
  quickTextDisabled:  { color: '#94A3B8' },
  quickCheck:         { position: 'absolute', top: 6, right: 6, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(94,133,224,0.3)', alignItems: 'center', justifyContent: 'center' },

  ewalletSection:     { backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1.5, borderColor: '#E2E8F0' },
  ewalletHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ewalletTitle:       { fontSize: 13, fontFamily: 'DMSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  ewalletSubtitle:    { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginBottom: 16 },

  methodGrid:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodCard:         { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 6, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', gap: 8, position: 'relative' },
  methodIconWrap:     { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodLabel:        { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#64748B', textAlign: 'center' },
  methodCheck:        { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  accountInputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 2, marginBottom: 16 },
  accountInput:       { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: Colors.text },

  mobileErrorRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -10, marginBottom: 12 },
  mobileErrorText:     { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#EF4444' },
  infoBanner:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BAE6FD' },
  infoBannerIcon:     { width: 38, height: 38, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  infoBannerTitle:    { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0369A1' },
  infoBannerBody:     { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#0284C7', marginTop: 2, lineHeight: 17 },

  footer:             { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Colors.background },
  summaryRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel:       { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#94A3B8' },
  summaryAmount:      { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text },
  submitBtn:          { borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#94A3B8' },
  submitBtnDisabled:  { opacity: 0.4 },
  submitBtnText:      { fontSize: 17, fontFamily: 'DMSans_700Bold', color: '#fff' },
});