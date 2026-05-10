import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getLoggedInUser } from '../../lib/storage';
import BottomNav from '../../components/BottomNav';
import OnboardingTutorial, { shouldShowOnboarding } from '../../components/OnboardingTutorial';

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

export default function StudentDashboard() {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser, studentBalance, spendingLimit,
    transactions, todaySpent, savingsGoals,
    refreshData, logoutUser, setLoggedInUser,
  } = useApp();
  const [localDisplayName, setLocalDisplayName] = useState<string>('');
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
  }, [refreshData]);

  const recentTransactions = transactions
    .filter(t => t.type === 'expense' || t.type === 'allowance')
    .slice(0, 5);

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
        },
      },
    ]);
  };

  const displayName = loggedInUser?.displayName || localDisplayName || 'there';

  const limitActive = spendingLimit?.isActive && (spendingLimit?.dailyLimit ?? 0) > 0;
  const limitUsedPercent = limitActive
    ? Math.min(todaySpent / (spendingLimit!.dailyLimit), 1)
    : 0;
  const limitRemaining = limitActive
    ? Math.max((spendingLimit!.dailyLimit) - todaySpent, 0)
    : 0;

  const activeGoals = savingsGoals.filter(g => g.currentAmount < g.targetAmount).slice(0, 2);
  const totalSaved = savingsGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
  const savingsGoalCount = savingsGoals.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.studentGradientStart, Colors.studentGradientEnd]}
        style={[styles.headerGradient, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Hi, {displayName}!</Text>
            <Text style={styles.headerSubtitle}>Your Allowance</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => { tap(); router.push('/changelog'); }} style={styles.whatsNewBtn}>
              <Ionicons name="megaphone-outline" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Pressable onPress={() => { tap(); router.push('/profile'); }} style={styles.avatarBtn}>
              <Text style={styles.avatarBtnText}>{(displayName || 'S')[0].toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>My Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(studentBalance)}</Text>
          {studentBalance <= 20 && studentBalance > 0 && (
            <View style={styles.lowBalanceAlert}>
              <Ionicons name="warning-outline" size={13} color="#FCD34D" />
              <Text style={styles.lowBalanceAlertText}>Your balance is getting low</Text>
            </View>
          )}
          {studentBalance === 0 && (
            <View style={styles.lowBalanceAlert}>
              <Ionicons name="alert-circle-outline" size={13} color="#FCD34D" />
              <Text style={[styles.lowBalanceAlertText, { color: '#FCD34D' }]}>No balance — ask your guardian!</Text>
            </View>
          )}
          {savingsGoalCount > 0 && (
            <Pressable onPress={() => { tap(); router.push('/student/goals'); }} style={styles.savingsPill}>
              <Ionicons name="trending-up" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.savingsPillText}>
                Savings: <Text style={styles.savingsPillAmount}>{formatCurrency(totalSaved)}</Text>
                <Text style={styles.savingsPillSub}> across {savingsGoalCount} goal{savingsGoalCount !== 1 ? 's' : ''}</Text>
              </Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
            </Pressable>
          )}
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.actionsRow}>
          <Pressable onPress={() => { tap(); router.push('/student/expense'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="cart" size={24} color="#DC2626" />
            </View>
            <Text style={styles.actionText}>Spend</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/student/goals'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="flag" size={22} color="#16A34A" />
            </View>
            <Text style={styles.actionText}>Goals</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/student/history'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="time" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.actionText}>History</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/student/cashout'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cash" size={22} color="#D97706" />
            </View>
            <Text style={styles.actionText}>Cash Out</Text>
          </Pressable>
        </Animated.View>

        {limitActive && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.limitCard}>
            <View style={styles.limitHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#D97706" />
              <Text style={styles.limitTitle}>Daily Spending Limit</Text>
              <Text style={styles.limitSubtitle}>{formatCurrency(spendingLimit!.dailyLimit)}/day</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${limitUsedPercent * 100}%` as any,
                backgroundColor: limitUsedPercent >= 1 ? '#DC2626' : limitUsedPercent >= 0.8 ? '#D97706' : '#16A34A',
              }]} />
            </View>
            <View style={styles.limitRow}>
              <Text style={styles.limitSpent}>Spent: {formatCurrency(todaySpent)}</Text>
              <Text style={[styles.limitLeft, { color: limitRemaining === 0 ? '#DC2626' : '#16A34A' }]}>
                Left: {formatCurrency(limitRemaining)}
              </Text>
            </View>
          </Animated.View>
        )}

        {activeGoals.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.goalsCard}>
            <View style={styles.goalsHeader}>
              <Text style={styles.goalsTitle}>My Goals</Text>
              <Pressable onPress={() => router.push('/student/goals')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            {activeGoals.map(goal => {
              const pct = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
              return (
                <Pressable key={goal.id} onPress={() => { tap(); router.push('/student/goals'); }} style={styles.goalRow}>
                  <View style={styles.goalIconBox}>
                    <Ionicons name={(goal.iconName as any) || 'star'} size={20} color={Colors.studentPrimary} />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalName}>{goal.name}</Text>
                    <View style={styles.goalProgress}>
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalFill, { width: `${pct * 100}%` as any }]} />
                      </View>
                      <Text style={styles.goalPct}>{Math.round(pct * 100)}%</Text>
                    </View>
                    <Text style={styles.goalAmounts}>
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentTransactions.length > 0 && (
              <Pressable onPress={() => router.push('/student/history')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            )}
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubtext}>Your transactions will appear here</Text>
            </View>
          ) : (
            recentTransactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, {
                  backgroundColor: tx.type === 'allowance' ? '#DCFCE7' : '#FEE2E2',
                }]}>
                  <Ionicons
                    name={tx.type === 'allowance' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={tx.type === 'allowance' ? '#16A34A' : '#DC2626'}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                </View>
                <Text style={[styles.txAmount, {
                  color: tx.type === 'allowance' ? '#16A34A' : '#DC2626',
                }]}>
                  {tx.type === 'allowance' ? '+' : '-'}{formatCurrency(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      <BottomNav
        userType="student"
        onLogout={handleLogout}
      />

      {showOnboarding && (
        <OnboardingTutorial
          role="student"
          onComplete={() => setShowOnboarding(false)}
        />
      )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whatsNewBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.white },
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 24 },
  balanceLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 40, fontFamily: 'DMSans_700Bold', color: Colors.white, marginBottom: 8 },
  lowBalanceAlert: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  lowBalanceAlertText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#FCD34D' },
  content: { flex: 1 },
  scrollContent: { padding: 24 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  actionPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  limitCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#D97706' },
  limitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  limitTitle: { flex: 1, fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#D97706' },
  limitSubtitle: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: Colors.textSecondary },
  progressTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between' },
  limitSpent: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  limitLeft: { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  goalsCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  goalsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  goalsTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  goalIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.studentPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text, marginBottom: 4 },
  goalProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  goalTrack: { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: Colors.studentPrimary, borderRadius: 3 },
  goalPct: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: Colors.studentPrimary, minWidth: 30 },
  goalAmounts: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text },
  seeAll: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.studentPrimary },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  txDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  savingsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  savingsPillText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.9)' },
  savingsPillAmount: { fontFamily: 'DMSans_700Bold', color: '#ffffff' },
  savingsPillSub: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});
