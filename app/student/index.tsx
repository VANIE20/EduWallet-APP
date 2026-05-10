import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getLoggedInUser } from '../../lib/storage';
import BottomNav from '../../components/BottomNav';
import OnboardingTutorial, { shouldShowOnboarding } from '../../components/OnboardingTutorial';
import AdBanner from '../../components/AdBanner';

// ── Ember palette: warm but deeper ───────────────────────────
const EMBER = {
  grad1:  '#6B1E00',   // deep burnt sienna
  grad2:  '#9A2E00',   // dark ember
  grad3:  '#C84B00',   // glowing orange-brown
  accent: '#F97316',
  deep:   '#6B1E00',   // for text on light bg
  warm:   '#FED7AA',
  bg:     '#FFF8F2',   // very soft warm white
};

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Weekly bar chart ───────────────────────────────────────── */
function WeeklyChart({ transactions }: { transactions: any[] }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date().getDay();
  const totals = Array(7).fill(0);
  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const d = new Date(tx.date);
      const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (diff < 7) totals[d.getDay()] += tx.amount;
    }
  });
  const maxVal = Math.max(...totals, 1);
  return (
    <View style={ch.row}>
      {totals.map((val, i) => {
        const pct = Math.max(val / maxVal, 0.04);
        const isToday = i === today;
        return (
          <View key={i} style={ch.col}>
            <View style={ch.track}>
              <View style={[ch.bar, { height: `${pct * 100}%` as any }, isToday && ch.barActive]} />
            </View>
            <Text style={[ch.label, isToday && ch.labelActive]}>{days[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ── Ring progress ──────────────────────────────────────────── */
function Ring({ pct, size = 64, color = EMBER.accent }: { pct: number; size?: number; color?: string }) {
  const bw = 5;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: bw, borderColor: 'rgba(0,0,0,0.06)' }} />
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: bw, borderColor: color,
        borderTopColor:    pct > 0    ? color : 'transparent',
        borderRightColor:  pct > 0.25 ? color : 'transparent',
        borderBottomColor: pct > 0.50 ? color : 'transparent',
        borderLeftColor:   pct > 0.75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 11, fontFamily: 'DMSans_700Bold', color: EMBER.deep }}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
}

export default function StudentDashboard() {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser, studentBalance, spendingLimit,
    transactions, todaySpent, savingsGoals,
    refreshData, logoutUser, setLoggedInUser,
  } = useApp();
  const [localDisplayName, setLocalDisplayName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    refreshData();
    getLoggedInUser().then(u => {
      if (u?.displayName && u.displayName !== 'User') {
        setLocalDisplayName(u.displayName);
        if (!loggedInUser) setLoggedInUser(u);
      }
    });
    shouldShowOnboarding().then(setShowOnboarding);
  }, [refreshData]);

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logoutUser(); } },
    ]);
  };

  const displayName = loggedInUser?.displayName || localDisplayName || 'there';
  const firstName   = displayName.split(' ')[0];

  const limitActive    = spendingLimit?.isActive && (spendingLimit?.dailyLimit ?? 0) > 0;
  const limitUsedPct   = limitActive ? Math.min(todaySpent / spendingLimit!.dailyLimit, 1) : 0;
  const limitRemaining = limitActive ? Math.max(spendingLimit!.dailyLimit - todaySpent, 0) : 0;
  const limitColor     = limitUsedPct >= 1 ? '#EF4444' : limitUsedPct >= 0.8 ? '#F59E0B' : EMBER.accent;

  const activeGoals = savingsGoals.filter(g => g.currentAmount < g.targetAmount).slice(0, 2);
  const totalSaved  = savingsGoals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const goalCount   = savingsGoals.length;

  const recentTx = transactions.filter(t => t.type === 'expense' || t.type === 'allowance').slice(0, 7);

  const ACTIONS = [
    { label: 'Spend',    icon: 'cart'  as const, tint: '#EF4444', route: '/student/expense'  },
    { label: 'Goals',   icon: 'flag'  as const, tint: '#10B981', route: '/student/goals'    },
    { label: 'History', icon: 'time'  as const, tint: EMBER.accent, route: '/student/history' },
    { label: 'Cash Out',icon: 'cash'  as const, tint: '#FBBF24', route: '/student/cashout'  },
  ];

  return (
    <View style={s.root}>

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <LinearGradient
        colors={[EMBER.grad1, EMBER.grad2, EMBER.grad3]}
        style={[s.header, { paddingTop: Platform.OS === 'web' ? 56 : insets.top + 14 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={s.blob1} />
        <View style={s.blob2} />

        {/* Top row */}
        <View style={s.topRow}>
          <View>
            <Text style={s.hi}>{getGreeting()} 👋</Text>
            <Text style={s.name}>{firstName}</Text>
          </View>
          <Pressable onPress={() => { tap(); router.push('/profile'); }} style={s.avatar}>
            <Text style={s.avatarLetter}>{(firstName || 'S')[0].toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Balance block */}
        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={s.balBlock}>

          <View style={s.balLabelRow}>
            <Text style={s.balLabel}>My Balance</Text>
            {goalCount > 0 && (
              <Pressable onPress={() => { tap(); router.push('/student/goals'); }} style={s.savedPill}>
                <Ionicons name="trending-up" size={12} color="#fff" />
                <Text style={s.savedPillText}>{formatCurrency(totalSaved)} saved</Text>
              </Pressable>
            )}
          </View>

          <Text style={s.balAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(studentBalance)}
          </Text>

          {studentBalance <= 20 && (
            <View style={s.warnRow}>
              <Ionicons name="warning-outline" size={13} color="#FCD34D" />
              <Text style={s.warnText}>
                {studentBalance === 0 ? 'No balance — ask your guardian!' : 'Balance is getting low'}
              </Text>
            </View>
          )}

          <View style={s.chartDivider} />
          <Text style={s.chartHeading}>Spending this week</Text>
          <WeeklyChart transactions={transactions} />
        </Animated.View>
      </LinearGradient>

      {/* ══ SCROLL BODY ═════════════════════════════════════════ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollInner, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.actions}>
          {ACTIONS.map(a => (
            <Pressable
              key={a.label}
              onPress={() => { tap(); router.push(a.route as any); }}
              style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
            >
              <View style={[s.actionIcon, { backgroundColor: a.tint + '1A' }]}>
                <Ionicons name={a.icon} size={20} color={a.tint} />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Spending limit */}
        {limitActive && (
          <Animated.View entering={FadeInDown.delay(240).duration(400)} style={s.limitCard}>
            <View style={s.limitLeft}>
              <View style={s.limitTitleRow}>
                <Ionicons name="shield-checkmark" size={14} color={limitColor} />
                <Text style={[s.limitTitle, { color: limitColor }]}>Daily Spending Limit</Text>
              </View>
              <Text style={s.limitAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(spendingLimit!.dailyLimit)}
              </Text>
              <View style={s.limitMetaRow}>
                <Text style={s.limitMeta}>Spent {formatCurrency(todaySpent)}</Text>
                <Text style={[s.limitMetaRight, { color: limitRemaining === 0 ? '#EF4444' : '#10B981' }]}>
                  {formatCurrency(limitRemaining)} left
                </Text>
              </View>
              <View style={s.limitTrack}>
                <View style={[s.limitFill, { width: `${limitUsedPct * 100}%` as any, backgroundColor: limitColor }]} />
              </View>
            </View>
            <Ring pct={limitUsedPct} color={limitColor} />
          </Animated.View>
        )}

        {/* Goals */}
        {activeGoals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(280).duration(400)} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>My Goals</Text>
              <Pressable onPress={() => router.push('/student/goals')} style={s.seeAllRow}>
                <Text style={s.seeAll}>See All</Text>
                <Ionicons name="chevron-forward" size={13} color={EMBER.accent} />
              </Pressable>
            </View>

            {activeGoals.map((goal, idx) => {
              const pct   = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
              const color = idx === 0 ? EMBER.accent : '#10B981';
              return (
                <Pressable
                  key={goal.id}
                  onPress={() => { tap(); router.push('/student/goals'); }}
                  style={[s.goalRow, idx < activeGoals.length - 1 && s.goalRowBorder]}
                >
                  <View style={[s.goalIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={(goal.iconName as any) || 'star'} size={18} color={color} />
                  </View>
                  <View style={s.goalBody}>
                    <View style={s.goalTopRow}>
                      <Text style={s.goalName} numberOfLines={1}>{goal.name}</Text>
                      <Text style={[s.goalPct, { color }]}>{Math.round(pct * 100)}%</Text>
                    </View>
                    <View style={s.goalTrack}>
                      <View style={[s.goalFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={s.goalAmounts}>
                      {formatCurrency(goal.currentAmount)}
                      <Text style={s.goalOf}> / {formatCurrency(goal.targetAmount)}</Text>
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* Ad banner */}
        <Animated.View entering={FadeInDown.delay(310).duration(400)} style={s.adWrap}>
          <AdBanner />
        </Animated.View>

        {/* Recent activity */}
        <Animated.View entering={FadeInDown.delay(340).duration(400)}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Recent Activity</Text>
            {recentTx.length > 0 && (
              <Pressable onPress={() => router.push('/student/history')} style={s.seeAllRow}>
                <Text style={s.seeAll}>See All</Text>
                <Ionicons name="chevron-forward" size={13} color={EMBER.accent} />
              </Pressable>
            )}
          </View>

          {recentTx.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={26} color="#CBD5E1" />
              </View>
              <Text style={s.emptyTitle}>No activity yet</Text>
              <Text style={s.emptySub}>Your transactions will appear here</Text>
            </View>
          ) : (
            recentTx.map((tx, i) => {
              const isIn = tx.type === 'allowance';
              return (
                <Animated.View
                  key={tx.id}
                  entering={FadeInDown.delay(340 + i * 45).duration(370)}
                  style={s.txRow}
                >
                  <View style={[s.txIcon, { backgroundColor: isIn ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={14} color={isIn ? '#059669' : '#DC2626'} />
                  </View>
                  <View style={s.txBody}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={s.txDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[s.txAmount, { color: isIn ? '#059669' : '#DC2626' }]}>
                    {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </Animated.View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      <BottomNav userType="student" onLogout={handleLogout} />
      {showOnboarding && <OnboardingTutorial role="student" onComplete={() => setShowOnboarding(false)} />}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: EMBER.bg },

  header: {
    paddingHorizontal: 22, paddingBottom: 26,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -30,
  },
  blob2: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 0, left: -20,
  },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  hi:     { fontSize: 12, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.65)' },
  name:   { fontSize: 24, fontFamily: 'DMSans_700Bold', color: '#fff', marginTop: 2 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#fff' },

  balBlock: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  balLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balLabel:     { fontSize: 12, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.65)' },
  savedPill:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  savedPillText:{ fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: '#fff' },
  balAmount:    { fontSize: 34, fontFamily: 'DMSans_700Bold', color: '#fff', marginBottom: 4 },
  warnRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  warnText:     { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#FCD34D' },
  chartDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 12 },
  chartHeading: { fontSize: 10, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },

  scroll:      { flex: 1 },
  scrollInner: { padding: 16, paddingTop: 18 },

  actions:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionBtn:  {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
    shadowColor: EMBER.grad1,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 3,
  },
  pressed:    { opacity: 0.82, transform: [{ scale: 0.95 }] },
  actionIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  actionLabel:{ fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: EMBER.deep },

  limitCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: EMBER.grad1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  limitLeft:    { flex: 1, minWidth: 0 },
  limitTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  limitTitle:   { fontSize: 11, fontFamily: 'DMSans_600SemiBold' },
  limitAmount:  { fontSize: 20, fontFamily: 'DMSans_700Bold', color: EMBER.deep, marginBottom: 5 },
  limitMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  limitMeta:    { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  limitMetaRight:{ fontSize: 11, fontFamily: 'DMSans_600SemiBold' },
  limitTrack:   { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  limitFill:    { height: '100%', borderRadius: 3 },

  adWrap: { marginBottom: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: EMBER.grad1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:  { fontSize: 15, fontFamily: 'DMSans_700Bold', color: EMBER.deep },
  seeAllRow:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll:     { fontSize: 12, fontFamily: 'DMSans_500Medium', color: EMBER.accent },

  goalRow:       { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  goalRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  goalIcon:      { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalBody:      { flex: 1, minWidth: 0 },
  goalTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  goalName:      { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: EMBER.deep, flex: 1, marginRight: 6 },
  goalPct:       { fontSize: 11, fontFamily: 'DMSans_700Bold', flexShrink: 0 },
  goalTrack:     { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
  goalFill:      { height: '100%', borderRadius: 3 },
  goalAmounts:   { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#475569' },
  goalOf:        { color: '#94A3B8' },

  txRow:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 13, padding: 11, marginBottom: 7,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 2,
  },
  txIcon:   { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  txBody:   { flex: 1, minWidth: 0 },
  txDesc:   { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: EMBER.deep },
  txDate:   { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginTop: 1 },
  txAmount: { fontSize: 13, fontFamily: 'DMSans_700Bold', marginLeft: 8 },

  empty:        { alignItems: 'center', paddingVertical: 32 },
  emptyIconWrap:{ width: 60, height: 60, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle:   { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#475569' },
  emptySub:     { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginTop: 3 },
});

const ch = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 4 },
  col:        { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  track:      { flex: 1, width: '100%', maxWidth: 24, justifyContent: 'flex-end' },
  bar:        { width: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.30)', minHeight: 3 },
  barActive:  { backgroundColor: '#fff' },
  label:      { fontSize: 9, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  labelActive:{ color: '#fff', fontFamily: 'DMSans_700Bold' },
});