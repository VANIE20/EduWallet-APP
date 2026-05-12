import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import ConfirmDialog, { DialogConfig } from '../../components/ConfirmDialog';
import { useApp } from '../../lib/AppContext';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];
type CashoutMethod = 'gcash' | 'maya' | 'card';

interface CashoutOption {
  id: CashoutMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  gradient: string;
  accountLabel: string;
  placeholder: string;
}

const CASHOUT_OPTIONS: CashoutOption[] = [
  {
    id: 'gcash',
    label: 'GCash',
    icon: 'phone-portrait-outline',
    color: '#007AFF',
    bg: '#EFF6FF',
    gradient: '#DBEAFE',
    accountLabel: 'GCash Mobile Number',
    placeholder: '09XX XXX XXXX',
  },
  {
    id: 'maya',
    label: 'Maya',
    icon: 'wallet-outline',
    color: '#16A34A',
    bg: '#DCFCE7',
    gradient: '#BBF7D0',
    accountLabel: 'Maya Mobile Number',
    placeholder: '09XX XXX XXXX',
  },
  {
    id: 'card',
    label: 'Bank / Card',
    icon: 'card-outline',
    color: '#7C3AED',
    bg: '#EDE9FE',
    gradient: '#DDD6FE',
    accountLabel: 'Account Number',
    placeholder: 'XXXX XXXX XXXX XXXX',
  },
];

export default function CashoutScreen() {
  const insets = useSafeAreaInsets();
  const { studentBalance, refreshData, cashoutStudent } = useApp();

  const [amount, setAmount]           = useState('');
  const [method, setMethod]           = useState<CashoutMethod>('gcash');
  const [accountNo, setAccountNo]     = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [dialog, setDialog]           = useState<DialogConfig | null>(null);

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const selMethod = CASHOUT_OPTIONS.find(o => o.id === method)!;
  const parsedAmount = parseFloat(amount);
  const isValid = parsedAmount > 0 && (
    method === 'card'
      ? accountNo.trim().length >= 6
      : accountNo.startsWith('09') && accountNo.replace(/\D/g, '').length >= 10 && accountNo.replace(/\D/g, '').length <= 11
  );
  const hasEnough = parsedAmount <= studentBalance;

  // ── Simulate cashout (UI-only) ───────────────────────────────────────────
  const handleCashout = useCallback(async () => {
    if (!isValid || !hasEnough) return;
    tap();

    setDialog({
      type: 'confirm',
      title: 'Confirm Cash Out',
      message: `Cash out ₱${parsedAmount.toFixed(2)} via ${selMethod.label} to ${accountNo}?`,
      confirmLabel: 'Cash Out',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await new Promise(r => setTimeout(r, 1500));
          await cashoutStudent(parsedAmount, selMethod.label, selMethod.accountLabel, accountNo);
          await refreshData();
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDialog({
            type: 'success',
            title: 'Cash Out Requested',
            message: `₱${parsedAmount.toFixed(2)} via ${selMethod.label} to ${accountNo} has been recorded. Processing takes 1–3 business days.`,
            confirmLabel: 'Done',
            onConfirm: () => router.back(),
          });
        } catch (err: any) {
          setDialog({
            type: 'error',
            title: 'Something went wrong',
            message: err?.message || 'Please try again.',
            confirmLabel: 'OK',
          });
        } finally {
          setSubmitting(false);
        }
      },
    });
  }, [isValid, hasEnough, parsedAmount, selMethod, accountNo, studentBalance, refreshData, cashoutStudent]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Cash Out</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Balance pill */}
        <View style={styles.balancePill}>
          <Ionicons name="wallet-outline" size={14} color="#0369A1" />
          <Text style={styles.balancePillText}>
            Available: <Text style={styles.balancePillAmount}>₱{studentBalance.toFixed(2)}</Text>
          </Text>
        </View>

        {/* Amount input */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>ENTER AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currencySign, parsedAmount > 0 && styles.currencySignActive]}>₱</Text>
            <TextInput
              style={[styles.amountInput, parsedAmount > 0 && styles.amountInputActive]}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              autoFocus
              editable={!isSubmitting}
            />
          </View>
          {parsedAmount > 0 && !hasEnough && (
            <View style={styles.insufficientPill}>
              <Ionicons name="warning-outline" size={12} color="#DC2626" />
              <Text style={styles.insufficientText}>Insufficient balance</Text>
            </View>
          )}
          {parsedAmount > 0 && hasEnough && (
            <View style={[styles.amountPill, { backgroundColor: selMethod.bg }]}>
              <Ionicons name={selMethod.icon} size={12} color={selMethod.color} />
              <Text style={[styles.amountPillText, { color: selMethod.color }]}>
                via {selMethod.label}
              </Text>
            </View>
          )}
        </View>

        {/* Quick amounts */}
        <Text style={styles.sectionLabel}>Quick Select</Text>
        <View style={styles.quickGrid}>
          {QUICK_AMOUNTS.map((val) => {
            const sel = amount === val.toString();
            const over = val > studentBalance;
            return (
              <Pressable
                key={val}
                onPress={() => { tap(); setAmount(val.toString()); }}
                disabled={isSubmitting || over}
                style={({ pressed }) => [
                  styles.quickBtn,
                  sel && styles.quickBtnActive,
                  over && styles.quickBtnDisabled,
                  pressed && !over && { opacity: 0.7 },
                ]}
              >
                {sel && (
                  <View style={styles.quickCheck}>
                    <Ionicons name="checkmark" size={9} color="#fff" />
                  </View>
                )}
                <Text style={[styles.quickText, sel && styles.quickTextActive, over && styles.quickTextDisabled]}>
                  ₱{val >= 1000 ? `${val / 1000}k` : val}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Cash-out methods */}
        <Text style={styles.sectionLabel}>Cash Out Via</Text>
        <View style={styles.methodGrid}>
          {CASHOUT_OPTIONS.map((opt) => {
            const sel = method === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => { tap(); setMethod(opt.id); setAccountNo(''); }}
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
        <View style={[styles.accountInputWrap, {
          borderColor: method !== 'card'
            ? (!accountNo.startsWith('09') && accountNo.length > 0
                ? '#DC2626'
                : accountNo.length >= 10 ? selMethod.color : '#E2E8F0')
            : (accountNo.length >= 6 ? selMethod.color : '#E2E8F0'),
        }]}>
          <Ionicons
            name={selMethod.icon}
            size={18}
            color={method !== 'card'
              ? (!accountNo.startsWith('09') && accountNo.length > 0
                  ? '#DC2626'
                  : accountNo.length >= 10 ? selMethod.color : '#94A3B8')
              : (accountNo.length >= 6 ? selMethod.color : '#94A3B8')}
            style={{ marginRight: 10 }}
          />
          <TextInput
            style={styles.accountInput}
            value={accountNo}
            onChangeText={(t) => {
              if (method !== 'card') {
                const digits = t.replace(/[^0-9]/g, '').slice(0, 11);
                setAccountNo(digits);
              } else {
                setAccountNo(t);
              }
            }}
            placeholder={selMethod.placeholder}
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            editable={!isSubmitting}
            maxLength={method === 'card' ? 19 : 11}
          />
          {method !== 'card' && accountNo.length > 0 && (
            <Ionicons
              name={
                !accountNo.startsWith('09')
                  ? 'alert-circle-outline'
                  : accountNo.length >= 10 ? 'checkmark-circle' : 'alert-circle-outline'
              }
              size={18}
              color={
                !accountNo.startsWith('09')
                  ? '#DC2626'
                  : accountNo.length >= 10 ? selMethod.color : '#DC2626'
              }
            />
          )}
        </View>

        {/* Validation hints */}
        {method !== 'card' && accountNo.length > 0 && !accountNo.startsWith('09') && (
          <View style={styles.accountWarningRow}>
            <Ionicons name="warning-outline" size={13} color="#DC2626" />
            <Text style={styles.accountHint}>Mobile number must start with 09</Text>
          </View>
        )}
        {method !== 'card' && accountNo.length > 0 && accountNo.startsWith('09') && accountNo.length < 10 && (
          <Text style={styles.accountHint}>
            {`${10 - accountNo.length} more digit${10 - accountNo.length !== 1 ? 's' : ''} needed`}
          </Text>
        )}

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIcon}>
            <Ionicons name="information-circle-outline" size={18} color="#0EA5E9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Simulated Cash Out</Text>
            <Text style={styles.infoBannerBody}>
              Cash-out is recorded in your history.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        {isValid && hasEnough && !isSubmitting && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You're cashing out</Text>
            <Text style={styles.summaryAmount}>₱{parsedAmount.toFixed(2)}</Text>
          </View>
        )}
        <Pressable
          onPress={handleCashout}
          disabled={!isValid || !hasEnough || isSubmitting}
          style={({ pressed }) => [
            styles.cashoutBtn,
            isValid && hasEnough && !isSubmitting && { backgroundColor: selMethod.color },
            (!isValid || !hasEnough) && !isSubmitting && styles.cashoutBtnDisabled,
            pressed && { opacity: 0.88 },
          ]}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.cashoutBtnText}>Processing…</Text>
            </>
          ) : (
            <>
              <Ionicons name="arrow-up-circle" size={22} color="#fff" />
              <Text style={styles.cashoutBtnText}>
                {isValid && hasEnough
                  ? `Cash Out ₱${parsedAmount.toFixed(2)}`
                  : !hasEnough && parsedAmount > 0
                  ? 'Insufficient Balance'
                  : 'Enter Amount & Account'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
      <ConfirmDialog config={dialog} onClose={() => setDialog(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#F8FAFC' },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:             { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle:          { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  scroll:               { flex: 1 },
  scrollContent:        { paddingHorizontal: 20, paddingBottom: 24 },
  balancePill:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 20 },
  balancePillText:      { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#0369A1' },
  balancePillAmount:    { fontFamily: 'DMSans_700Bold', color: '#0369A1' },
  amountCard:           { backgroundColor: Colors.white, borderRadius: 24, padding: 28, marginBottom: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  amountLabel:          { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 12 },
  amountRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  currencySign:         { fontSize: 36, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', marginRight: 4, marginTop: 6 },
  currencySignActive:   { color: Colors.text },
  amountInput:          { fontSize: 56, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', minWidth: 100, textAlign: 'center' },
  amountInputActive:    { color: Colors.text },
  amountPill:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 14 },
  amountPillText:       { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  insufficientPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 14, backgroundColor: '#FEE2E2' },
  insufficientText:     { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#DC2626' },
  sectionLabel:         { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  quickGrid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  quickBtn:             { width: '30.5%' as any, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', position: 'relative' },
  quickBtnActive:       { backgroundColor: Colors.text, borderColor: Colors.text },
  quickBtnDisabled:     { opacity: 0.35 },
  quickText:            { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  quickTextActive:      { color: Colors.white },
  quickTextDisabled:    { color: '#94A3B8' },
  quickCheck:           { position: 'absolute', top: 6, right: 6, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(94,133,224,0.3)', alignItems: 'center', justifyContent: 'center' },
  methodGrid:           { flexDirection: 'row', gap: 10, marginBottom: 24 },
  methodCard:           { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 6, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', gap: 8, position: 'relative' },
  methodIconWrap:       { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodLabel:          { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#64748B', textAlign: 'center' },
  methodCheck:          { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  accountInputWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 2, marginBottom: 6 },
  accountInput:         { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: Colors.text },
  accountWarningRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, marginLeft: 4 },
  accountHint:          { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#DC2626', marginBottom: 18, marginLeft: 4 },
  infoBanner:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BAE6FD', marginTop: 8 },
  infoBannerIcon:       { width: 38, height: 38, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  infoBannerTitle:      { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0369A1' },
  infoBannerBody:       { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#0284C7', marginTop: 2, lineHeight: 17 },
  footer:               { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  summaryRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel:         { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#94A3B8' },
  summaryAmount:        { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text },
  cashoutBtn:           { backgroundColor: '#94A3B8', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cashoutBtnDisabled:   { opacity: 0.4 },
  cashoutBtnText:       { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});