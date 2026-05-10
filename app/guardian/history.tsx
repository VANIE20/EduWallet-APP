import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import type { Transaction } from '../../lib/storage';

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDailyTotals(transactions: Transaction[]): { label: string; amount: number }[] {
  const map: Record<string, number> = {};
  const now = new Date();
  transactions.forEach(tx => {
    if (tx.type !== 'deposit' && tx.type !== 'allowance') return;
    const d = new Date(tx.date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays >= 7) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map[key] = (map[key] || 0) + tx.amount;
  });
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => new Date(b.label).getTime() - new Date(a.label).getTime());
}

function TransactionItem({ item, studentName }: { item: Transaction; studentName?: string }) {
  const isDeposit = item.type === 'deposit';
  const isAllowance = item.type === 'allowance';

  // Deposit = money IN (green), Allowance = money OUT to student (red)
  const iconName = isDeposit ? 'arrow-down-circle' : 'arrow-up-circle';
  const iconColor = isDeposit ? '#16A34A' : '#EF4444';
  const iconBg = isDeposit ? '#DCFCE7' : '#FEE2E2';
  const amountColor = isDeposit ? '#16A34A' : '#EF4444';
  const amountPrefix = isDeposit ? '+' : '-';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.txDate}>{formatFullDate(item.date)}</Text>
        <Text style={styles.txRef}>{item.referenceId}</Text>
        {isAllowance && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              Sent to {studentName || 'student'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.txAmount, { color: amountColor }]}>
        {amountPrefix}{formatCurrency(item.amount)}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { transactions, refreshData, linkedStudents } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  // Build a map of studentId -> displayName for quick lookup
  const studentNameMap: Record<string, string> = {};
  linkedStudents?.forEach(s => {
    studentNameMap[s.id] = s.displayName;
  });

  // Show deposits (money added to guardian wallet) and allowances (sent to student)
  // Sort newest first
  const guardianTx = transactions
    .filter(t => t.type === 'deposit' || t.type === 'allowance')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  const dailyTotals = getDailyTotals(transactions);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 40 }} />
      </View>

      {guardianTx.length > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {guardianTx.length} transaction{guardianTx.length !== 1 ? 's' : ''} shown
          </Text>
        </View>
      )}

      {dailyTotals.length > 0 && (
        <View style={styles.dailyCard}>
          <Text style={styles.dailyTitle}>Daily Activity (Last 7 Days)</Text>
          {dailyTotals.map(({ label, amount }) => (
            <View key={label} style={styles.dailyRow}>
              <Text style={styles.dailyLabel}>{label}</Text>
              <View style={styles.dailyBarWrap}>
                <View style={[styles.dailyBar, {
                  width: `${Math.min((amount / Math.max(...dailyTotals.map(d => d.amount))) * 100, 100)}%` as any,
                }]} />
              </View>
              <Text style={styles.dailyAmount}>{formatCurrency(amount)}</Text>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={guardianTx}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            studentName={
              item.type === 'allowance' && item.toUserId
                ? studentNameMap[item.toUserId] ?? linkedStudents?.find(s => s.id === item.toUserId)?.displayName
                : item.type === 'allowance'
                ? linkedStudents?.[0]?.displayName
                : undefined
            }
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              Deposits and allowances sent to your student will appear here.
            </Text>
          </View>
        }
      />
    </View>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text,
  },
  summaryRow: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  summaryText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: Colors.textTertiary,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  txInfo: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text,
  },
  txDate: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  txRef: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 5,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
    color: '#D97706',
  },
  txAmount: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textTertiary,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dailyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#3D0000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  dailyTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1E1E2E',
    marginBottom: 10,
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 8,
  },
  dailyLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#64748B',
    width: 60,
  },
  dailyBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  dailyBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#8B1A1A',
  },
  dailyAmount: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#1E1E2E',
    width: 72,
    textAlign: 'right',
  },
});