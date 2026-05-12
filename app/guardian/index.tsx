import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Platform, Alert, Modal, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getLoggedInUser } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import BottomNav from '../../components/BottomNav';
import OnboardingTutorial, { shouldShowOnboarding } from '../../components/OnboardingTutorial';
import AdBanner from '../../components/AdBanner';

// ── Guardian theme: Maroon palette ───────────────────────────────
const EMBER = {
  grad1:  '#6B1E00',   // deep burnt sienna
  grad2:  '#9A2E00',   // dark ember
  grad3:  '#C84B00',   // glowing orange-brown
  accent: '#F97316',
  deep:   '#6B1E00',
  warm:   '#FED7AA',
  bg:     '#FFF8F2',
  pill1:  '#FED7AA',
  pill2:  '#FDE68A',
};

// G is the active theme alias used throughout this screen
const G = {
  ...EMBER,
  pill3:      '#BBF7D0',   // soft green for student count pill
  accentSoft: '#FB923C',   // lighter orange for icons/gradients
};

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Stat pill ───────────────────────────────────────────────── */
function StatPill({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={[sp.pill, { borderColor: accent + '50', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
      <Text style={[sp.value, { color: '#fff' }]}>{value}</Text>
      <Text style={sp.label}>{label}</Text>
    </View>
  );
}
const sp = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  value: { fontSize: 14, fontFamily: 'DMSans_700Bold', marginBottom: 2 },
  label: { fontSize: 10, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
});

/* ── Donut ring ──────────────────────────────────────────────── */
function SpendRing({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const size = 72;
  const bw = 7;
  const safeColor = pct >= 1 ? '#EF4444' : pct >= 0.75 ? '#F59E0B' : '#10B981';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: bw, borderColor: 'rgba(0,0,0,0.06)', position: 'absolute',
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: bw,
        borderColor: safeColor,
        borderTopColor: pct > 0 ? safeColor : 'transparent',
        borderRightColor: pct > 0.25 ? safeColor : 'transparent',
        borderBottomColor: pct > 0.5 ? safeColor : 'transparent',
        borderLeftColor: pct > 0.75 ? safeColor : 'transparent',
        position: 'absolute',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 11, fontFamily: 'DMSans_700Bold', color: safeColor }}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
}

export default function GuardianDashboard() {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser, isLinked, guardianBalance, studentBalance,
    allowanceConfig, spendingLimit, transactions, todaySpent,
    refreshData, logoutUser, setLoggedInUser,
    linkedStudents, selectedStudentId, selectStudent,
  } = useApp();
  const [localDisplayName, setLocalDisplayName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    refreshData();
    getLoggedInUser().then(u => {
      if (u?.displayName && u.displayName !== 'User') {
        setLocalDisplayName(u.displayName);
        if (!loggedInUser) setLoggedInUser(u);
      }
    });
    shouldShowOnboarding().then(show => setShowOnboarding(show));
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('avatar_url').eq('auth_user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    });
  }, [refreshData]);

  const guardianTransactions = transactions
    .filter(t => t.type === 'deposit' || t.type === 'allowance')
    .slice(0, 7);

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logoutUser(); } },
    ]);
  };

  const displayName = loggedInUser?.displayName || localDisplayName || 'there';
  const rawUsername = loggedInUser?.username || '';
  const firstName = rawUsername.length > 10 ? 'Megoo' : (rawUsername || 'there');
  const selectedStudent = linkedStudents.find(s => s.id === selectedStudentId);
  const selectedStudentName = selectedStudent?.displayName || 'Student';
  const hasMultiple = linkedStudents.length > 1;

  const limitActive = spendingLimit?.isActive && (spendingLimit?.dailyLimit ?? 0) > 0;
  const limitUsed = limitActive ? Math.min(todaySpent / spendingLimit!.dailyLimit, 1) : 0;

  const weekTotal = transactions
    .filter(t => t.type === 'allowance')
    .filter(t => (new Date().getTime() - new Date(t.date).getTime()) < 7 * 86400000)
    .reduce((s, t) => s + t.amount, 0);

  const actions = [
    { label: 'Deposit', icon: 'add-circle' as const, bg: '#10B981', route: '/guardian/deposit' },
    { label: 'Send', icon: 'send' as const, bg: '#8B1A1A', route: '/guardian/send' },
    { label: 'Schedule', icon: 'calendar' as const, bg: '#3B82F6', route: '/guardian/schedule' },
    { label: 'Limit', icon: 'shield' as const, bg: '#EF4444', route: '/guardian/spending-limit' },
  ];

  return (
    <View style={s.container}>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={[G.grad1, G.grad2, G.grad3]}
        style={[s.headerGradient, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Subtle decorative circles */}
        <View style={s.decorCircle1} />
        <View style={s.decorCircle2} />

        {/* Top row */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.greetingSmall}>{getTimeOfDay()} 👋</Text>
            <Text style={s.greeting}>{firstName}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => router.push('/help')} style={s.helpBtn}>
              <Text style={s.helpBtnText}>Need Help?</Text>
            </Pressable>
            <Pressable onPress={() => { tap(); router.push('/profile'); }} style={s.avatarBtn}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                : <Text style={s.avatarText}>{(displayName || 'U')[0].toUpperCase()}</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* Balance split card */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.balanceSplit}>
          {/* Guardian wallet */}
          <View style={s.balanceSide}>
            <Text style={s.balLabel}>Your Wallet</Text>
            <Text style={s.balAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(guardianBalance)}
            </Text>
          </View>

          <View style={s.balDivider} />

          {/* Student balance */}
          <Pressable
            style={s.balanceSide}
            onPress={() => hasMultiple && setStudentPickerOpen(true)}
            disabled={!hasMultiple}
          >
            <View style={s.balStudentRow}>
              <Text style={s.balLabel} numberOfLines={1}>{selectedStudentName}</Text>
              {hasMultiple && <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.5)" />}
            </View>
            <Text style={s.balStudentAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(studentBalance)}
            </Text>
            {studentBalance === 0 && (
              <View style={s.alertBadge}>
                <Ionicons name="warning-outline" size={10} color="#FCD34D" />
                <Text style={s.balAlert}>No balance</Text>
              </View>
            )}
            {studentBalance > 0 && studentBalance <= 10 && (
              <View style={s.alertBadge}>
                <Ionicons name="warning-outline" size={10} color="#FCD34D" />
                <Text style={s.balAlert}>Balance low</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(220).duration(450)} style={s.statsRow}>
          <StatPill label="Sent this week" value={formatCurrency(weekTotal)} accent={G.pill1} />
          <View style={{ width: 8 }} />
          <StatPill label="Today spent" value={formatCurrency(todaySpent)} accent={G.pill2} />
          <View style={{ width: 8 }} />
          <StatPill label="Students" value={String(linkedStudents.length || 0)} accent={G.pill3} />
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── QUICK ACTIONS ───────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(260).duration(450)} style={s.actionsRow}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              onPress={() => { tap(); router.push(a.route as any); }}
              style={({ pressed }) => [s.actionBtn, pressed && s.actionPressed]}
            >
              <View style={[s.actionIcon, { backgroundColor: a.bg + '18' }]}>
                <Ionicons name={a.icon} size={20} color={a.bg} />
              </View>
              <Text style={s.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── INVITE / ADD STUDENT BANNER ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(290).duration(450)}>
          <Pressable
            onPress={() => { tap(); router.push('/guardian/invite-student'); }}
            style={s.inviteBanner}
          >
            <LinearGradient
              colors={[G.grad2, G.accentSoft]}
              style={s.inviteBannerInner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={s.inviteLeft}>
                <View style={s.inviteIconWrap}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={s.inviteTitle}>
                    {isLinked ? 'Add another student' : 'Link a student'}
                  </Text>
                  <Text style={s.inviteSub}>
                    {isLinked ? 'Manage more students' : 'Send an invitation now'}
                  </Text>
                </View>
              </View>
              <View style={s.inviteArrow}>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ── LINKED STUDENTS ─────────────────────────────────────── */}
        {linkedStudents.length > 0 && (
          <Animated.View entering={FadeInDown.delay(310).duration(450)} style={s.card}>
            <Text style={s.cardTitle}>Linked Students</Text>
            <View style={s.studentGrid}>
              {linkedStudents.map(student => {
                const isActive = student.id === selectedStudentId;
                const initial = (student.displayName || 'S')[0].toUpperCase();
                return (
                  <View key={student.id} style={s.studentCell}>
                    <Pressable
                      onPress={() => { tap(); selectStudent(student.id); }}
                      style={[s.studentChip, isActive && s.studentChipActive]}
                    >
                      <LinearGradient
                        colors={isActive ? [G.grad2, G.accentSoft] : ['#F1F5F9', '#E2E8F0']}
                        style={s.studentAvatar}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      >
                        <Text style={[s.studentAvatarText, !isActive && { color: '#475569' }]}>{initial}</Text>
                      </LinearGradient>
                      <Text style={[s.studentName, isActive && s.studentNameActive]} numberOfLines={1}>
                        {student.displayName}
                      </Text>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={14} color={G.accentSoft} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        tap();
                        router.push({ pathname: '/remove-student', params: { studentId: student.id, studentName: student.displayName } });
                      }}
                      style={s.removeBtn}
                    >
                      <Ionicons name="person-remove-outline" size={13} color="#EF4444" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── SPENDING LIMIT ──────────────────────────────────────── */}
        {limitActive && (
          <Animated.View entering={FadeInDown.delay(330).duration(450)} style={s.card}>
            <Pressable onPress={() => router.push('/guardian/spending-limit')}>
              <View style={s.cardHeaderRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={s.cardTitle}>Daily Limit</Text>
                  <Text style={s.cardSub}>{selectedStudentName} · Tap to adjust</Text>
                </View>
                <SpendRing used={todaySpent} total={spendingLimit!.dailyLimit} />
              </View>
              <View style={s.limitStats}>
                <View style={s.limitStat}>
                  <Text style={s.limitStatLabel}>Limit</Text>
                  <Text style={s.limitStatVal} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(spendingLimit!.dailyLimit)}
                  </Text>
                </View>
                <View style={s.limitStatDivider} />
                <View style={s.limitStat}>
                  <Text style={s.limitStatLabel}>Spent</Text>
                  <Text
                    style={[s.limitStatVal, { color: todaySpent >= spendingLimit!.dailyLimit ? '#EF4444' : '#1E1E2E' }]}
                    numberOfLines={1} adjustsFontSizeToFit
                  >
                    {formatCurrency(todaySpent)}
                  </Text>
                </View>
                <View style={s.limitStatDivider} />
                <View style={s.limitStat}>
                  <Text style={s.limitStatLabel}>Remaining</Text>
                  <Text style={[s.limitStatVal, { color: '#10B981' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(Math.max(spendingLimit!.dailyLimit - todaySpent, 0))}
                  </Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={s.limitTrack}>
                <View style={[s.limitFill, {
                  width: `${limitUsed * 100}%` as any,
                  backgroundColor: limitUsed >= 1 ? '#EF4444' : limitUsed >= 0.75 ? '#F59E0B' : '#10B981',
                }]} />
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── AUTO ALLOWANCE ──────────────────────────────────────── */}
        {allowanceConfig?.isActive && (
          <Animated.View entering={FadeInDown.delay(350).duration(450)} style={s.allowanceCard}>
            <LinearGradient
              colors={[G.grad1, G.grad2]}
              style={s.allowanceInner}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={s.allowanceRow}>
                <View style={s.allowanceIconWrap}>
                  <Ionicons name="time" size={20} color="rgba(255,255,255,0.8)" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.allowanceLabel}>Auto-Allowance · {selectedStudentName}</Text>
                  <Text style={s.allowanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(allowanceConfig.amount)}
                  </Text>
                </View>
                <View style={s.allowanceFreqBadge}>
                  <Text style={s.allowanceFreq}>{allowanceConfig.frequency}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── AD BANNER ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(370).duration(450)} style={{ marginBottom: 18 }}>
          <AdBanner />
        </Animated.View>

        {/* ── RECENT ACTIVITY ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(390).duration(450)}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.cardTitle}>Recent Activity</Text>
            {guardianTransactions.length > 0 && (
              <Pressable onPress={() => router.push('/guardian/history')} style={s.seeAllBtn}>
                <Text style={s.seeAll}>See All</Text>
                <Ionicons name="chevron-forward" size={13} color={G.accentSoft} />
              </Pressable>
            )}
          </View>

          {guardianTransactions.length === 0 ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Ionicons name="wallet-outline" size={28} color="#CBD5E1" />
              </View>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptySub}>Deposit funds to get started</Text>
            </View>
          ) : (
            guardianTransactions.map((tx, i) => {
              const isDeposit = tx.type === 'deposit';
              return (
                <Animated.View
                  key={tx.id}
                  entering={FadeInDown.delay(390 + i * 50).duration(400)}
                  style={s.txRow}
                >
                  <View style={[s.txIcon, { backgroundColor: isDeposit ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Ionicons
                      name={isDeposit ? 'arrow-down' : 'send'}
                      size={15}
                      color={isDeposit ? '#059669' : '#DC2626'}
                    />
                  </View>
                  <View style={s.txBody}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={s.txDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[s.txAmount, { color: isDeposit ? '#059669' : '#DC2626' }]}>
                    {isDeposit ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </Animated.View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      {/* ── STUDENT PICKER MODAL ─────────────────────────────────── */}
      <Modal
        visible={studentPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStudentPickerOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setStudentPickerOpen(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Switch Student</Text>
            {linkedStudents.map(student => (
              <Pressable
                key={student.id}
                onPress={() => { tap(); selectStudent(student.id); setStudentPickerOpen(false); }}
                style={[s.modalRow, student.id === selectedStudentId && s.modalRowActive]}
              >
                <LinearGradient
                  colors={student.id === selectedStudentId ? [G.grad2, G.accentSoft] : ['#F1F5F9', '#E2E8F0']}
                  style={s.modalAvatar}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={[s.modalAvatarText, student.id !== selectedStudentId && { color: '#475569' }]}>
                    {(student.displayName || 'S')[0].toUpperCase()}
                  </Text>
                </LinearGradient>
                <Text style={s.modalStudentName}>{student.displayName}</Text>
                {student.id === selectedStudentId && (
                  <Ionicons name="checkmark-circle" size={20} color={G.accentSoft} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <BottomNav userType="guardian" onLogout={handleLogout} />

      {showOnboarding && (
        <OnboardingTutorial role="guardian" onComplete={() => setShowOnboarding(false)} />
      )}
    </View>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F4F4' },

  /* ── Header ── */
  headerGradient: {
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)', top: -60, right: -40,
  },
  decorCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.03)', bottom: 0, left: -40,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  greetingSmall: {
    fontSize: 12, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.55)',
  },
  greeting: {
    fontSize: 24, fontFamily: 'DMSans_700Bold',
    color: '#fff', marginTop: 2,
  },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  helpBtn: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  helpBtnText: {
    fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#fff',
  },
  avatarText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#fff' },

  /* ── Balance split card ── */
  balanceSplit: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    marginBottom: 12,
  },
  balanceSide: { flex: 1, minWidth: 0 },
  balDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 14 },
  balLabel: {
    fontSize: 11, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.55)', marginBottom: 4,
  },
  balAmount: {
    fontSize: 22, fontFamily: 'DMSans_700Bold',
    color: '#fff', minHeight: 28,
  },
  balStudentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balStudentAmount: {
    fontSize: 22, fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.85)', minHeight: 28,
  },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  balAlert: {
    fontSize: 11, fontFamily: 'DMSans_500Medium',
    color: '#FCD34D',
  },

  /* ── Stats row ── */
  statsRow: { flexDirection: 'row' },

  /* ── Scroll ── */
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingTop: 22 },

  /* ── Quick actions ── */
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3D0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  actionPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  actionIcon: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  actionText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#1E1E2E' },

  /* ── Invite banner ── */
  inviteBanner: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  inviteBannerInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 18,
  },
  inviteLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  inviteTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#fff' },
  inviteSub: {
    fontSize: 11, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.7)', marginTop: 2,
  },
  inviteArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#3D0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#1E1E2E' },
  cardSub: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginTop: 2 },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#C0392B' },

  /* ── Students ── */
  studentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  studentCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  studentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  studentChipActive: { borderColor: '#C0392B', backgroundColor: '#FFF5F5' },
  studentAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  studentAvatarText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#fff' },
  studentName: {
    fontSize: 12, fontFamily: 'DMSans_500Medium',
    color: '#475569', maxWidth: 75,
  },
  studentNameActive: { color: '#C0392B', fontFamily: 'DMSans_600SemiBold' },
  removeBtn: { padding: 5 },

  /* ── Spending limit ── */
  limitStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  limitStat: { flex: 1, alignItems: 'center', minWidth: 0 },
  limitStatDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
  limitStatLabel: {
    fontSize: 10, fontFamily: 'DMSans_400Regular',
    color: '#94A3B8', marginBottom: 3,
  },
  limitStatVal: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#1E1E2E' },
  limitTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  limitFill: { height: '100%', borderRadius: 3 },

  /* ── Allowance card ── */
  allowanceCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  allowanceInner: { padding: 16, borderRadius: 18 },
  allowanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  allowanceIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  allowanceLabel: {
    fontSize: 11, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.6)', marginBottom: 3,
  },
  allowanceAmount: { fontSize: 20, fontFamily: 'DMSans_700Bold', color: '#fff' },
  allowanceFreqBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  allowanceFreq: {
    fontSize: 11, fontFamily: 'DMSans_600SemiBold',
    color: '#fff', textTransform: 'capitalize',
  },

  /* ── Transactions ── */
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 8,
    shadowColor: '#3D0000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  txBody: { flex: 1, minWidth: 0 },
  txDesc: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#1E1E2E' },
  txDate: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: 'DMSans_700Bold', marginLeft: 8 },

  /* ── Empty state ── */
  emptyState: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: '#475569' },
  emptySub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#94A3B8', marginTop: 4 },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 44,
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: '#E2E8F0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#1E1E2E', marginBottom: 16 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 7,
    backgroundColor: '#F8FAFC',
  },
  modalRowActive: { backgroundColor: '#FFF5F5' },
  modalAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  modalAvatarText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#fff' },
  modalStudentName: { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: '#1E1E2E' },
});