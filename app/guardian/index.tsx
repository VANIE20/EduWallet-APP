import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Alert, FlatList, Modal } from 'react-native';
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

export default function GuardianDashboard() {
  const insets = useSafeAreaInsets();
  const {
    loggedInUser, isLinked, guardianBalance, studentBalance,
    allowanceConfig, spendingLimit, transactions, todaySpent,
    refreshData, logoutUser, setLoggedInUser,
    linkedStudents, selectedStudentId, selectStudent,
  } = useApp();
  const [localDisplayName, setLocalDisplayName] = useState<string>('');
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  useEffect(() => {
    refreshData();
    getLoggedInUser().then(u => {
      if (u?.displayName && u.displayName !== 'User') {
        setLocalDisplayName(u.displayName);
        if (!loggedInUser) setLoggedInUser(u);
      }
    });
  }, [refreshData]);

  const guardianTransactions = transactions.filter(
    t => t.type === 'deposit' || t.type === 'allowance'
  ).slice(0, 5);

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
  const selectedStudent = linkedStudents.find(s => s.id === selectedStudentId);
  const selectedStudentName = selectedStudent?.displayName || 'Student';
  const hasMultipleStudents = linkedStudents.length > 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.guardianGradientStart, Colors.guardianGradientEnd]}
        style={[styles.headerGradient, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Hi, {displayName}!</Text>
            <Text style={styles.headerSubtitle}>Wallet Overview</Text>
          </View>
          <Pressable onPress={() => { tap(); router.push('/profile'); }} style={styles.avatarBtn}>
            <Text style={styles.avatarBtnText}>{(displayName || 'U')[0].toUpperCase()}</Text>
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Wallet</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(guardianBalance)}</Text>

          {/* Student balance row — tappable switcher if multiple students */}
          <Pressable
            style={styles.studentBalanceRow}
            onPress={() => hasMultipleStudents && setStudentPickerOpen(true)}
            disabled={!hasMultipleStudents}
          >
            <Ionicons name="school-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.studentBalanceText}>
              {selectedStudentName}: {formatCurrency(studentBalance)}
            </Text>
            {hasMultipleStudents && (
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
            )}
          </Pressable>

          {studentBalance <= 10 && studentBalance > 0 && (
            <View style={styles.lowBalanceAlert}>
              <Ionicons name="warning-outline" size={13} color="#FCD34D" />
              <Text style={styles.lowBalanceAlertText}>Student balance is low</Text>
            </View>
          )}
          {studentBalance === 0 && (
            <View style={styles.lowBalanceAlert}>
              <Ionicons name="alert-circle-outline" size={13} color="#FCD34D" />
              <Text style={[styles.lowBalanceAlertText, { color: '#FCD34D' }]}>Student has no balance</Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.actionsRow}>
          <Pressable onPress={() => { tap(); router.push('/guardian/deposit'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="add-circle" size={24} color="#16A34A" />
            </View>
            <Text style={styles.actionText}>Deposit</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/guardian/send'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="send" size={22} color="#D97706" />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/guardian/schedule'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="calendar" size={22} color="#9B1C1C" />
            </View>
            <Text style={styles.actionText}>Schedule</Text>
          </Pressable>

          <Pressable onPress={() => { tap(); router.push('/guardian/spending-limit'); }} style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="shield" size={22} color="#EF4444" />
            </View>
            <Text style={styles.actionText}>Limit</Text>
          </Pressable>
        </Animated.View>

        {/* Invite banner — always visible so guardian can add more students */}
        <Animated.View entering={FadeInDown.delay(320).duration(500)}>
          <Pressable onPress={() => { tap(); router.push('/guardian/invite-student'); }} style={styles.linkBanner}>
            <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
            <Text style={styles.linkBannerText}>
              {isLinked ? 'Add another student' : 'No student linked yet — tap to invite one'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </Pressable>
        </Animated.View>

        {/* Linked students list (only when more than 1) */}
        {linkedStudents.length > 1 && (
          <Animated.View entering={FadeInDown.delay(330).duration(500)} style={styles.studentsCard}>
            <Text style={styles.studentsCardTitle}>Linked Students</Text>
            {linkedStudents.map(student => (
              <Pressable
                key={student.id}
                onPress={() => { tap(); selectStudent(student.id); }}
                style={[styles.studentRow, student.id === selectedStudentId && styles.studentRowActive]}
              >
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>{(student.displayName || 'S')[0].toUpperCase()}</Text>
                </View>
                <Text style={[styles.studentName, student.id === selectedStudentId && styles.studentNameActive]}>
                  {student.displayName}
                </Text>
                {student.id === selectedStudentId && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </Animated.View>
        )}

        {spendingLimit && spendingLimit.isActive && spendingLimit.dailyLimit > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)}>
            <Pressable onPress={() => router.push('/guardian/spending-limit')} style={styles.limitCard}>
              <View style={styles.limitHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                <Text style={styles.limitTitle}>Daily Spending Limit — {selectedStudentName}</Text>
              </View>
              <View style={styles.limitDetails}>
                <View style={styles.limitItem}>
                  <Text style={styles.limitLabel}>Limit</Text>
                  <Text style={styles.limitValue}>{formatCurrency(spendingLimit.dailyLimit)}</Text>
                </View>
                <View style={styles.limitDivider} />
                <View style={styles.limitItem}>
                  <Text style={styles.limitLabel}>Spent Today</Text>
                  <Text style={[styles.limitValue, { color: todaySpent >= spendingLimit.dailyLimit ? Colors.danger : Colors.text }]}>
                    {formatCurrency(todaySpent)}
                  </Text>
                </View>
                <View style={styles.limitDivider} />
                <View style={styles.limitItem}>
                  <Text style={styles.limitLabel}>Remaining</Text>
                  <Text style={[styles.limitValue, { color: Colors.success }]}>
                    {formatCurrency(Math.max(spendingLimit.dailyLimit - todaySpent, 0))}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {allowanceConfig && allowanceConfig.isActive && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Ionicons name="time" size={20} color={Colors.primary} />
              <Text style={styles.scheduleTitle}>Auto-Allowance — {selectedStudentName}</Text>
            </View>
            <View style={styles.scheduleDetails}>
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleLabel}>Amount</Text>
                <Text style={styles.scheduleValue}>{formatCurrency(allowanceConfig.amount)}</Text>
              </View>
              <View style={styles.scheduleDivider} />
              <View style={styles.scheduleItem}>
                <Text style={styles.scheduleLabel}>Frequency</Text>
                <Text style={styles.scheduleValue}>{allowanceConfig.frequency}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {guardianTransactions.length > 0 && (
              <Pressable onPress={() => router.push('/guardian/history')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            )}
          </View>

          {guardianTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Deposit funds to get started</Text>
            </View>
          ) : (
            guardianTransactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'deposit' ? '#DCFCE7' : '#FEF3C7' }]}>
                  <Ionicons name={tx.type === 'deposit' ? 'arrow-down' : 'arrow-up'} size={18} color={tx.type === 'deposit' ? '#16A34A' : '#D97706'} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'deposit' ? '#16A34A' : '#D97706' }]}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* Student picker modal */}
      <Modal
        visible={studentPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStudentPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStudentPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Student</Text>
            {linkedStudents.map(student => (
              <Pressable
                key={student.id}
                onPress={() => {
                  tap();
                  selectStudent(student.id);
                  setStudentPickerOpen(false);
                }}
                style={[styles.modalStudentRow, student.id === selectedStudentId && styles.modalStudentRowActive]}
              >
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>{(student.displayName || 'S')[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.modalStudentName}>{student.displayName}</Text>
                {student.id === selectedStudentId && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <BottomNav
        userType="guardian"
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
  balanceAmount: { fontSize: 40, fontFamily: 'DMSans_700Bold', color: Colors.white, marginBottom: 12 },
  studentBalanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  studentBalanceText: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.7)' },
  lowBalanceAlert: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  lowBalanceAlertText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#FCD34D' },
  content: { flex: 1 },
  scrollContent: { padding: 24 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  actionPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  linkBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 20, gap: 10, borderWidth: 1, borderColor: Colors.primary },
  linkBannerText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.primary },
  studentsCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  studentsCardTitle: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  studentRowActive: { backgroundColor: Colors.primaryLight },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
  studentName: { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: Colors.text },
  studentNameActive: { fontFamily: 'DMSans_600SemiBold', color: Colors.primary },
  limitCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#D97706' },
  limitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  limitTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: '#D97706', flex: 1 },
  limitDetails: { flexDirection: 'row', alignItems: 'center' },
  limitItem: { flex: 1, alignItems: 'center' },
  limitDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  limitLabel: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginBottom: 4 },
  limitValue: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.text },
  scheduleCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  scheduleTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.primary, flex: 1 },
  scheduleDetails: { flexDirection: 'row', alignItems: 'center' },
  scheduleItem: { flex: 1, alignItems: 'center' },
  scheduleDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  scheduleLabel: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginBottom: 4 },
  scheduleValue: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text, textTransform: 'capitalize' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text },
  seeAll: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  txDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 16 },
  modalStudentRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 8 },
  modalStudentRowActive: { backgroundColor: Colors.primaryLight },
  modalStudentName: { flex: 1, fontSize: 16, fontFamily: 'DMSans_500Medium', color: Colors.text },
});
