import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getLoggedInUser } from '../../lib/storage';
import { getWeeklySpentByCategory, getPendingInvites } from '../../lib/storage';
import BottomNav from '../../components/BottomNav';

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

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  food: { icon: 'fast-food', color: '#F97316', bg: '#FFF7ED', label: 'Food' },
  transport: { icon: 'bus', color: '#3B82F6', bg: '#EFF6FF', label: 'Transport' },
  entertainment: { icon: 'game-controller', color: '#8B5CF6', bg: '#F5F3FF', label: 'Fun' },
  school: { icon: 'book', color: '#9B1C1C', bg: '#F0FDFA', label: 'School' },
  savings: { icon: 'trending-up', color: '#10B981', bg: '#FFF7ED', label: 'Savings' },
  other: { icon: 'ellipsis-horizontal', color: '#6B7280', bg: '#F9FAFB', label: 'Other' },
};

const LOW_BALANCE_THRESHOLD = 10;

export default function StudentDashboard() {
  const insets = useSafeAreaInsets();
  const { loggedInUser, isLinked, studentBalance, transactions, savingsGoals, spendingLimit, todaySpent, refreshData, logoutUser, setLoggedInUser } = useApp();

  const [pendingInviteCount, setPendingInviteCount] = React.useState(0);
  const [localDisplayName, setLocalDisplayName] = React.useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshData();
    getPendingInvites().then(invites => setPendingInviteCount(invites.length));
    getLoggedInUser().then(u => {
      if (u?.displayName && u.displayName !== 'User') {
        setLocalDisplayName(u.displayName);
        if (!loggedInUser) setLoggedInUser(u);
      }
    });
  }, [refreshData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await refreshData();
      const invites = await getPendingInvites();
      setPendingInviteCount(invites.length);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  const studentTransactions = transactions.filter(
    t => t.type === 'expense' || (t.type === 'allowance' && t.to === 'student')
  ).slice(0, 5);

  const weeklySpent = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= weekAgo)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const weeklyByCategory = useMemo(() => getWeeklySpentByCategory(transactions), [transactions]);
  const weeklyTotalForBreakdown = Object.values(weeklyByCategory).reduce((sum, v) => sum + v, 0);

  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  const isLowBalance = studentBalance > 0 && studentBalance <= LOW_BALANCE_THRESHOLD;
  const isZeroBalance = studentBalance === 0;
  const hasSpendingLimit = spendingLimit && spendingLimit.isActive && spendingLimit.dailyLimit > 0;
  const limitRemaining = hasSpendingLimit ? Math.max(spendingLimit!.dailyLimit - todaySpent, 0) : null;
  const isNearLimit = hasSpendingLimit && todaySpent >= spendingLimit!.dailyLimit * 0.8;
  const isAtLimit = hasSpendingLimit && todaySpent >= spendingLimit!.dailyLimit;

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logoutUser();
          router.replace('/login');
        },
      },
    ]);
  };

  const displayName = loggedInUser?.displayName || localDisplayName || 'there';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#9B1C1C', '#F59E0B']}
        style={[styles.headerGradient, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Hi, {displayName}!</Text>
            <Text style={styles.headerSubtitle}>My Balance</Text>
          </View>
          <Pressable onPress={() => { tap(); router.push('/profile'); }} style={styles.avatarBtn}>
            <Text style={styles.avatarBtnText}>{(displayName || 'U')[0].toUpperCase()}</Text>
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(studentBalance)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(weeklySpent)}</Text>
              <Text style={styles.statLabel}>Spent this week</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(totalSaved)}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#9B1C1C"
            colors={['#9B1C1C', '#F59E0B']}
          />
        }
      >
        {pendingInviteCount > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <Pressable onPress={() => router.push('/pending-invites')} style={styles.inviteBanner}>
              <Ionicons name="mail-unread" size={20} color="#0284C7" />
              <Text style={styles.inviteBannerText}>
                You have {pendingInviteCount} pending guardian invite{pendingInviteCount > 1 ? 's' : ''} — tap to review
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#0284C7" />
            </Pressable>
          </Animated.View>
        )}

        {!isLinked && pendingInviteCount === 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View style={styles.notLinkedBanner}>
              <Ionicons name="link-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.notLinkedText}>Not linked to a guardian yet. Ask your guardian to send you an invite.</Text>
            </View>
          </Animated.View>
        )}

        {(isLowBalance || isZeroBalance) && (
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.warningCard}>
            <View style={[styles.warningIconBg, { backgroundColor: isZeroBalance ? '#FEE2E2' : '#FEF3C7' }]}>
              <Ionicons name={isZeroBalance ? 'alert-circle' : 'warning'} size={22} color={isZeroBalance ? Colors.danger : '#D97706'} />
            </View>
            <View style={styles.warningContent}>
              <Text style={[styles.warningTitle, { color: isZeroBalance ? Colors.danger : '#92400E' }]}>
                {isZeroBalance ? 'No Balance' : 'Low Balance'}
              </Text>
              <Text style={styles.warningText}>
                {isZeroBalance ? 'Your balance is empty. Ask your guardian for an allowance.' : `Only ${formatCurrency(studentBalance)} left. Spend wisely!`}
              </Text>
            </View>
          </Animated.View>
        )}

        {hasSpendingLimit && (
          <Animated.View entering={FadeInDown.delay(270).duration(500)} style={[
            styles.limitBanner,
            isAtLimit && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
            !isAtLimit && isNearLimit && { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
          ]}>
            <Ionicons name="shield-checkmark" size={18} color={isAtLimit ? Colors.danger : isNearLimit ? '#D97706' : '#9B1C1C'} />
            <Text style={[styles.limitBannerText, { color: isAtLimit ? Colors.danger : isNearLimit ? '#92400E' : '#991B1B' }]}>
              {isAtLimit
                ? 'Daily limit reached - no more spending today'
                : `${formatCurrency(limitRemaining!)} of ${formatCurrency(spendingLimit!.dailyLimit)} daily limit remaining`}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.actionsRow}>
          <Pressable onPress={() => { tap(); router.push('/student/expense'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="remove-circle" size={24} color="#EF4444" />
            </View>
            <Text style={styles.actionText}>Expense</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/student/goals'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="flag" size={22} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Goals</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/student/history'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="receipt" size={22} color="#8B5CF6" />
            </View>
            <Text style={styles.actionText}>History</Text>
          </Pressable>
        </Animated.View>

        {weeklyTotalForBreakdown > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.breakdownCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>This Week</Text>
              <Text style={styles.breakdownTotal}>{formatCurrency(weeklyTotalForBreakdown)}</Text>
            </View>
            <View style={styles.breakdownBarOuter}>
              {Object.entries(weeklyByCategory).map(([cat, amount]) => {
                const pct = (amount / weeklyTotalForBreakdown) * 100;
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
                return <View key={cat} style={[styles.breakdownBarSegment, { width: `${pct}%` as any, backgroundColor: config.color }]} />;
              })}
            </View>
            <View style={styles.breakdownList}>
              {Object.entries(weeklyByCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => {
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
                const pct = Math.round((amount / weeklyTotalForBreakdown) * 100);
                return (
                  <View key={cat} style={styles.breakdownRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: config.color }]} />
                    <View style={[styles.breakdownCatIcon, { backgroundColor: config.bg }]}>
                      <Ionicons name={config.icon as any} size={16} color={config.color} />
                    </View>
                    <Text style={styles.breakdownCatLabel}>{config.label}</Text>
                    <Text style={styles.breakdownPercent}>{pct}%</Text>
                    <Text style={styles.breakdownAmount}>{formatCurrency(amount)}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {savingsGoals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Savings Goals</Text>
              <Pressable onPress={() => router.push('/student/goals')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            {savingsGoals.slice(0, 2).map((goal) => {
              const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
              return (
                <Pressable key={goal.id} onPress={() => router.push('/student/goals')} style={styles.goalCard}>
                  <View style={[styles.goalIcon, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name={(goal.iconName || 'flag') as any} size={22} color="#10B981" />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalName}>{goal.name}</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                    </View>
                    <Text style={styles.goalProgress}>{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</Text>
                  </View>
                  <Text style={styles.goalPercent}>{Math.round(progress * 100)}%</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {studentTransactions.length > 0 && (
              <Pressable onPress={() => router.push('/student/history')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            )}
          </View>

          {studentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubtext}>Your transactions will appear here</Text>
            </View>
          ) : (
            studentTransactions.map((tx) => {
              const catInfo = CATEGORY_CONFIG[tx.category || 'other'] || CATEGORY_CONFIG.other;
              const isIncoming = tx.type === 'allowance';
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: isIncoming ? '#DCFCE7' : catInfo.bg }]}>
                    <Ionicons name={(isIncoming ? 'arrow-down' : catInfo.icon) as any} size={18} color={isIncoming ? '#16A34A' : catInfo.color} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: isIncoming ? '#16A34A' : '#EF4444' }]}>
                    {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      <BottomNav
        userType="student"
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerGradient: { paddingHorizontal: 24, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  headerCenter: { flex: 1 },
  greeting: { fontSize: 22, fontFamily: 'DMSans_700Bold', color: Colors.white },
  headerSubtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.white },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 24 },
  balanceLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 40, fontFamily: 'DMSans_700Bold', color: Colors.white, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  statValue: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.white },
  statLabel: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  content: { flex: 1 },
  scrollContent: { padding: 24 },
  warningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  warningIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', marginBottom: 2 },
  warningText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#78716C', lineHeight: 18 },
  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  limitBannerText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_500Medium', lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 14, alignItems: 'center', shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  actionPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  actionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  breakdownCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, marginBottom: 24, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  breakdownTotal: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#EF4444' },
  breakdownBarOuter: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 16, backgroundColor: '#E5E7EB' },
  breakdownBarSegment: { height: '100%' },
  breakdownList: { gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  breakdownCatIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  breakdownCatLabel: { flex: 1, fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.text },
  breakdownPercent: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginRight: 12 },
  breakdownAmount: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text },
  seeAll: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: '#9B1C1C' },
  goalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text, marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  goalProgress: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  goalPercent: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#10B981', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  txDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  inviteBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', borderRadius: 14, padding: 16, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: '#0284C7' },
  inviteBannerText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_500Medium', color: '#0284C7' },
  notLinkedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundSecondary, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: Colors.border },
  notLinkedText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
});
