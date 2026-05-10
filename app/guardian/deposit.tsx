import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, KeyboardAvoidingView, ScrollView, Linking, ActivityIndicator,
  AppState, AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import ConfirmDialog, { DialogConfig } from '../../components/ConfirmDialog';
import { useApp } from '../../lib/AppContext';

const PAYMONGO_SECRET_KEY = 'sk_test_hv5EDbVcAJRG2jbDgDe2bMr3';

function toBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  const bytes = Array.from(str).map(c => c.charCodeAt(0));
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    const b1 = bytes[i++] ?? 0;
    const b2 = bytes[i++] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i - 2 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i - 1 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}
const BASE64_SECRET = toBase64(`${PAYMONGO_SECRET_KEY}:`);

const POLL_MS      = 3000;
const POLL_MAX     = 100; // ~5 minutes

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];
type PaymentMethod  = 'gcash' | 'maya' | 'card';

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  gradient: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'gcash', label: 'GCash', icon: 'phone-portrait-outline', color: '#007AFF', bg: '#EFF6FF', gradient: '#DBEAFE' },
  { id: 'maya',  label: 'Maya',  icon: 'wallet-outline',          color: '#16A34A', bg: '#DCFCE7', gradient: '#BBF7D0' },
  { id: 'card',  label: 'Card',  icon: 'card-outline',            color: '#7C3AED', bg: '#EDE9FE', gradient: '#DDD6FE' },
];

// ─── PayMongo helpers ───────────────────────────────────────────────────────

async function createCheckoutSession(
  amountPHP: number,
  payMethod: PaymentMethod,
  redirectBase: string,
): Promise<{ url: string; id: string }> {
  const amountCentavos = Math.round(amountPHP * 100);
  const pmMethod = payMethod === 'card' ? 'card' : payMethod === 'maya' ? 'paymaya' : 'gcash';

  const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${BASE64_SECRET}` },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [{ currency: 'PHP', amount: amountCentavos, name: 'Wallet Deposit', quantity: 1 }],
          payment_method_types: [pmMethod],
          description: 'Guardian wallet top-up',
          success_url: `${redirectBase}?status=success`,
          cancel_url:  `${redirectBase}?status=cancel`,
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.errors?.[0]?.detail || 'PayMongo error');
  }
  const data = await res.json();
  return { url: data.data.attributes.checkout_url as string, id: data.data.id as string };
}

/** Returns the session status AND the payments array (to double-check paid state). */
async function fetchSessionFull(sessionId: string): Promise<{ status: string; payments: any[] }> {
  const res = await fetch(
    `https://api.paymongo.com/v1/checkout_sessions/${sessionId}`,
    { headers: { Authorization: `Basic ${BASE64_SECRET}` } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const attr = data.data?.attributes ?? {};
  return {
    status:   attr.status ?? '',
    payments: attr.payments ?? [],
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DepositScreen() {
  const insets = useSafeAreaInsets();
  const { depositToGuardian, refreshData } = useApp();

  const [amount, setAmount]         = useState('');
  const [method, setMethod]         = useState<PaymentMethod>('gcash');
  const [isSubmitting, setSubmit]   = useState(false);
  const [dialog, setDialog]         = useState<DialogConfig | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [statusMsg, setStatusMsg]   = useState('');     // shown under spinner
  const [showManual, setShowManual] = useState(false);  // "I've paid" button

  const sessionRef    = useRef<{ id: string; amount: number; method: PaymentMethod } | null>(null);
  const pollCountRef  = useRef(0);
  const isFinishedRef = useRef(false);
  const pollTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef   = useRef<AppStateStatus>(AppState.currentState);

  // Keep latest context fns in refs (avoids stale closures in callbacks)
  const depositRef = useRef(depositToGuardian);
  const refreshRef = useRef(refreshData);
  useEffect(() => { depositRef.current = depositToGuardian; }, [depositToGuardian]);
  useEffect(() => { refreshRef.current = refreshData; },       [refreshData]);

  // ── clearTimer helper ────────────────────────────────────────────────────
  const clearTimer = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  };

  // ── reset to idle state ──────────────────────────────────────────────────
  const resetState = useCallback(() => {
    isFinishedRef.current = true;
    clearTimer();
    sessionRef.current   = null;
    pollCountRef.current = 0;
    setSubmit(false);
    setLoadingMsg('');
    setStatusMsg('');
    setShowManual(false);
  }, []);

  // ── credit wallet + record transaction ──────────────────────────────────
  const saveDeposit = useCallback(async (paidAmt: number, paidMethod: string) => {
    if (isFinishedRef.current) return;   // prevent double-run
    isFinishedRef.current = true;
    clearTimer();
    sessionRef.current   = null;
    pollCountRef.current = 0;

    setLoadingMsg('Saving deposit to your wallet…');
    setStatusMsg('');
    setShowManual(false);

    try {
      await depositRef.current(paidAmt, `PayMongo deposit via ${paidMethod.toUpperCase()}`);
      await refreshRef.current();
    } catch (dbErr: any) {
      // Payment is confirmed by PayMongo but DB write failed.
      // Show the error prominently so user can contact support.
      setSubmit(false);
      setLoadingMsg('');
      setDialog({
        type: 'error',
        title: 'Save Failed',
        message: `PayMongo confirmed your payment of ₱${paidAmt.toFixed(2)}, but we could not save it: ${dbErr?.message ?? 'Unknown error'}. Please screenshot this and contact support.`,
        confirmLabel: 'OK',
      });
      return;
    }

    setSubmit(false);
    setLoadingMsg('');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDialog({
      type: 'success',
      title: 'Deposit Successful',
      message: `₱${paidAmt.toFixed(2)} has been added to your wallet and is ready to use.`,
      confirmLabel: 'Done',
      onConfirm: () => router.back(),
    });
  }, []);

  // ── single poll cycle ────────────────────────────────────────────────────
  const doPollRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const doPoll = useCallback(async () => {
    if (isFinishedRef.current || !sessionRef.current) return;

    pollCountRef.current += 1;

    // Timeout
    if (pollCountRef.current > POLL_MAX) {
      resetState();
      setDialog({
        type: 'info',
        title: 'Payment Timeout',
        message: "We could not confirm your payment automatically. If GCash/Maya was charged, tap \"I've Completed Payment\" on the deposit screen.",
        confirmLabel: 'OK',
      });
      return;
    }

    try {
      const { status, payments } = await fetchSessionFull(sessionRef.current.id);

      setStatusMsg(`Status: ${status} (check #${pollCountRef.current})`);

      // PayMongo marks session "paid" when checkout is complete.
      // Also treat it as paid if the payments array has a "paid" payment (belt + suspenders).
      const isPaid =
        status === 'paid' ||
        (payments.length > 0 && payments.some((p: any) => p.attributes?.status === 'paid'));

      if (isPaid) {
        const { amount: a, method: m } = sessionRef.current;
        await saveDeposit(a, m);
        return;
      }

      if (status === 'expired' || status === 'cancelled') {
        resetState();
        setDialog({ type: 'error', title: 'Session Ended', message: 'Your checkout session expired or was cancelled. Please try again.', confirmLabel: 'OK' });
        return;
      }

      // Still active — schedule next poll
      pollTimerRef.current = setTimeout(() => doPollRef.current?.(), POLL_MS);
    } catch (err: any) {
      setStatusMsg(`Poll error: ${err?.message}`);
      pollTimerRef.current = setTimeout(() => doPollRef.current?.(), POLL_MS);
    }
  }, [saveDeposit, resetState]);

  doPollRef.current = doPoll;

  // ── restart polling immediately (fast) ──────────────────────────────────
  const kickPoll = useCallback(() => {
    if (isFinishedRef.current || !sessionRef.current) return;
    clearTimer();
    pollCountRef.current = 0;   // reset so we get a fresh batch
    doPollRef.current?.();
  }, []);

  // ── "I've Completed Payment" — user manually confirms ───────────────────
  const handleManualConfirm = useCallback(() => {
    if (!sessionRef.current || isFinishedRef.current) return;
    setLoadingMsg('Verifying payment…');
    setShowManual(false);
    kickPoll();
  }, [kickPoll]);

  // ── Deep-link back from PayMongo ─────────────────────────────────────────
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!sessionRef.current || isFinishedRef.current) return;
      if (!url.includes('deposit') && !url.includes('status=')) return;

      const match  = url.match(/[?&]status=([^&]+)/);
      const status = match?.[1] ?? '';

      if (status === 'success') {
        setLoadingMsg('Verifying payment…');
        setShowManual(false);
        kickPoll();
      } else if (status === 'cancel') {
        resetState();
        setDialog({ type: 'info', title: 'Payment Cancelled', message: 'You cancelled the payment.', confirmLabel: 'OK' });
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    return () => sub.remove();
  }, [kickPoll, resetState]);

  // ── AppState: app comes to foreground ────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      if (wasBackground && nextState === 'active' && sessionRef.current && !isFinishedRef.current) {
        setLoadingMsg('Checking payment status…');
        setShowManual(true);   // show manual button immediately on return
        kickPoll();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [kickPoll]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    isFinishedRef.current = true;
    clearTimer();
  }, []);

  // ── Start deposit ─────────────────────────────────────────────────────────
  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const handleDeposit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    if (val < 20) { setDialog({ type: 'info', title: 'Minimum Amount', message: 'Minimum deposit is ₱20.', confirmLabel: 'OK' }); return; }

    setSubmit(true);
    setLoadingMsg('Creating checkout session…');
    setStatusMsg('');
    setShowManual(false);
    tap();

    try {
      const { url, id: sessionId } = await createCheckoutSession(val, method, 'eduwallet://deposit');

      // Store session BEFORE opening browser
      sessionRef.current    = { id: sessionId, amount: val, method };
      isFinishedRef.current = false;
      pollCountRef.current  = 0;

      await Linking.openURL(url);

      setLoadingMsg('Waiting for payment…');
      setStatusMsg('Complete payment in browser, then return here');
      // Start slow polling while browser is open
      pollTimerRef.current = setTimeout(() => doPollRef.current?.(), POLL_MS);

    } catch (e: any) {
      resetState();
      setDialog({ type: 'error', title: 'Error', message: e.message || 'Something went wrong. Please try again.', confirmLabel: 'OK' });
    }
  };

  const handleCancel = () => {
    setDialog({ type: 'confirm', title: 'Cancel Payment?', message: 'Stop waiting for this deposit?', confirmLabel: 'Stop', cancelLabel: 'Keep Waiting', onConfirm: () => { resetState(); }, onCancel: () => {} }); void ([
      { text: 'Keep Waiting', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: resetState },
    ]);
  };

  const parsedAmount = parseFloat(amount);
  const isValid      = parsedAmount > 0;
  const selMethod    = PAYMENT_OPTIONS.find(o => o.id === method)!;
  const returnedFromBrowser = showManual && isSubmitting;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={isSubmitting ? handleCancel : () => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Amount input */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>ENTER AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currencySign, isValid && styles.currencySignActive]}>₱</Text>
            <TextInput
              style={[styles.amountInput, isValid && styles.amountInputActive]}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.0"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              autoFocus
              editable={!isSubmitting}
            />
          </View>
          {isValid && (
            <View style={[styles.amountPill, { backgroundColor: selMethod.bg }]}>
              <Ionicons name={selMethod.icon} size={12} color={selMethod.color} />
              <Text style={[styles.amountPillText, { color: selMethod.color }]}>via {selMethod.label}</Text>
            </View>
          )}
        </View>

        {/* Quick amounts */}
        <Text style={styles.sectionLabel}>Quick Select</Text>
        <View style={styles.quickGrid}>
          {QUICK_AMOUNTS.map((val) => {
            const sel = amount === val.toString();
            return (
              <Pressable key={val} onPress={() => { tap(); setAmount(val.toString()); }} disabled={isSubmitting}
                style={({ pressed }) => [styles.quickBtn, sel && styles.quickBtnActive, pressed && { opacity: 0.7 }]}>
                {sel && <View style={styles.quickCheck}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
                <Text style={[styles.quickText, sel && styles.quickTextActive]}>₱{val >= 1000 ? `${val / 1000}k` : val}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Payment methods */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_OPTIONS.map((opt) => {
            const sel = method === opt.id;
            return (
              <Pressable key={opt.id} onPress={() => { tap(); setMethod(opt.id); }} disabled={isSubmitting}
                style={[styles.methodCard, sel && { borderColor: opt.color, backgroundColor: opt.bg }]}>
                <View style={[styles.methodIconWrap, { backgroundColor: sel ? opt.gradient : '#F1F5F9' }]}>
                  <Ionicons name={opt.icon} size={24} color={sel ? opt.color : '#94A3B8'} />
                </View>
                <Text style={[styles.methodLabel, sel && { color: opt.color }]}>{opt.label}</Text>
                {sel && <View style={[styles.methodCheck, { backgroundColor: opt.color }]}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
              </Pressable>
            );
          })}
        </View>

        {/* Polling status card */}
        {isSubmitting && (
          <View style={styles.pollingCard}>
            <ActivityIndicator color="#0EA5E9" size="small" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pollingTitle}>{loadingMsg || 'Checking payment…'}</Text>
              {!!statusMsg && <Text style={styles.statusDebug}>{statusMsg}</Text>}
              <Text style={styles.pollingBody}>
                {returnedFromBrowser
                  ? 'Tap the green button below if you\'ve already paid.'
                  : 'Complete payment in the browser, then come back here.'}
              </Text>
            </View>
          </View>
        )}

        {/* Manual confirm — shown after returning from browser */}
        {returnedFromBrowser && (
          <Pressable onPress={handleManualConfirm} style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.82 }]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.manualBtnText}>I've Completed Payment</Text>
          </Pressable>
        )}

        {!isSubmitting && (
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}><Ionicons name="shield-checkmark" size={18} color="#0EA5E9" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Secure Payment</Text>
              <Text style={styles.infoBannerBody}>Processed by PayMongo · 🧪 Test mode</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        {isValid && !isSubmitting && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You're adding</Text>
            <Text style={styles.summaryAmount}>₱{parsedAmount.toFixed(2)}</Text>
          </View>
        )}
        <Pressable
          onPress={isSubmitting ? handleCancel : handleDeposit}
          disabled={!isValid && !isSubmitting}
          style={({ pressed }) => [
            styles.depositBtn,
            isSubmitting             && styles.depositBtnCancel,
            isValid && !isSubmitting && { backgroundColor: selMethod.color },
            !isValid && !isSubmitting && styles.depositBtnDisabled,
            pressed                  && { opacity: 0.88 },
          ]}
        >
          {isSubmitting
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.depositBtnText}>Cancel Payment</Text></>
            : <><Ionicons name="add-circle" size={22} color="#fff" /><Text style={styles.depositBtnText}>{isValid ? `Deposit ₱${parsedAmount.toFixed(2)}` : 'Enter an Amount'}</Text></>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#F8FAFC' },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 },
  headerTitle:         { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  scroll:              { flex: 1 },
  scrollContent:       { paddingHorizontal: 20, paddingBottom: 24 },
  amountCard:          { backgroundColor: Colors.white, borderRadius: 24, padding: 28, marginBottom: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  amountLabel:         { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 12 },
  amountRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  currencySign:        { fontSize: 36, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', marginRight: 4, marginTop: 6 },
  currencySignActive:  { color: Colors.text },
  amountInput:         { fontSize: 56, fontFamily: 'DMSans_700Bold', color: '#CBD5E1', minWidth: 100, textAlign: 'center' },
  amountInputActive:   { color: Colors.text },
  amountPill:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 14 },
  amountPillText:      { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  sectionLabel:        { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  quickGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  quickBtn:            { width: '30.5%' as any, backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', position: 'relative' },
  quickBtnActive:      { backgroundColor: Colors.text, borderColor: Colors.text },
  quickText:           { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  quickTextActive:     { color: Colors.white },
  quickCheck:          { position: 'absolute', top: 6, right: 6, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(94,133,224,0.3)', alignItems: 'center', justifyContent: 'center' },
  methodGrid:          { flexDirection: 'row', gap: 10, marginBottom: 24 },
  methodCard:          { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 6, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', gap: 8, position: 'relative' },
  methodIconWrap:      { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodLabel:         { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#64748B' },
  methodCheck:         { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pollingCard:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 12 },
  pollingTitle:        { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0369A1', marginBottom: 2 },
  statusDebug:         { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#0284C7', marginBottom: 3, fontStyle: 'italic' },
  pollingBody:         { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#0284C7', lineHeight: 17 },
  manualBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  manualBtnText:       { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#fff' },
  infoBanner:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BAE6FD' },
  infoBannerIcon:      { width: 38, height: 38, borderRadius: 10, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  infoBannerTitle:     { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0369A1' },
  infoBannerBody:      { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#0284C7', marginTop: 2 },
  footer:              { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  summaryRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel:        { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#94A3B8' },
  summaryAmount:       { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text },
  depositBtn:          { backgroundColor: '#94A3B8', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  depositBtnCancel:    { backgroundColor: '#EF4444' },
  depositBtnDisabled:  { opacity: 0.4 },
  depositBtnText:      { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});