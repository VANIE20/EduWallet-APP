import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import type { SavingsGoal } from '../../lib/storage';

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function GoalCard({ goal, onContribute, onDelete }: { goal: SavingsGoal; onContribute: (id: string) => void; onDelete: (id: string) => void }) {
  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const isComplete = progress >= 1;

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalIconCircle, { backgroundColor: isComplete ? '#DCFCE7' : '#E0E7FF' }]}>
          <Ionicons
            name={(goal.iconName || 'flag') as any}
            size={24}
            color={isComplete ? '#16A34A' : '#6366F1'}
          />
        </View>
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalProgress}>
            {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
          </Text>
        </View>
        <Pressable onPress={() => onDelete(goal.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, {
          width: `${Math.min(progress * 100, 100)}%` as any,
          backgroundColor: isComplete ? '#16A34A' : '#6366F1',
        }]} />
      </View>

      <View style={styles.goalFooter}>
        <Text style={[styles.goalPercent, { color: isComplete ? '#16A34A' : '#6366F1' }]}>
          {Math.round(progress * 100)}%
        </Text>
        {!isComplete && (
          <Pressable
            onPress={() => onContribute(goal.id)}
            style={({ pressed }) => [styles.contributeBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add" size={18} color="#6366F1" />
            <Text style={styles.contributeBtnText}>Add funds</Text>
          </Pressable>
        )}
        {isComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.completeText}>Complete</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { savingsGoals, studentBalance, contributeToGoal, deleteSavingsGoal } = useApp();
  const [contributeModal, setContributeModal] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleContribute = async () => {
    if (!contributeModal || isSaving) return;
    const val = parseFloat(contributeAmount);
    if (!val || val <= 0 || val > studentBalance) return;
    const activeGoal = savingsGoals.find(g => g.id === contributeModal);
    if (!activeGoal) return;
    const remaining = activeGoal.targetAmount - activeGoal.currentAmount;
    const actual = Math.min(val, remaining);
    if (actual <= 0) return;
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await contributeToGoal(contributeModal, val);
    setIsSaving(false);
    setContributeModal(null);
    setContributeAmount('');
  };

  const handleDelete = (goalId: string) => {
    tap();
    Alert.alert(
      'Delete Goal',
      'Any saved funds will be returned to your balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSavingsGoal(goalId) },
      ]
    );
  };

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Savings Goals</Text>
        <Pressable onPress={() => { tap(); router.push('/student/add-goal'); }} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#6366F1" />
        </Pressable>
      </View>

      <FlatList
        data={savingsGoals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onContribute={(id) => { tap(); setContributeModal(id); }}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={savingsGoals.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No savings goals yet</Text>
            <Text style={styles.emptySubtext}>Set a goal and start saving toward it</Text>
            <Pressable
              onPress={() => router.push('/student/add-goal')}
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.createBtnText}>Create Goal</Text>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={!!contributeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setContributeModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setContributeModal(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add to Savings</Text>
            {(() => {
              const activeGoal = savingsGoals.find(g => g.id === contributeModal);
              const remaining = activeGoal ? activeGoal.targetAmount - activeGoal.currentAmount : 0;
              const val = parseFloat(contributeAmount) || 0;
              const actual = Math.min(val, remaining);
              const overGoal = val > remaining && val > 0;
              const isDisabled = isSaving || val <= 0 || val > studentBalance;
              return (
                <>
                  <Text style={styles.modalSubtitle}>
                    Available: {formatCurrency(studentBalance)}
                  </Text>
                  {activeGoal && (
                    <Text style={styles.modalRemaining}>
                      Needed to complete: {formatCurrency(remaining)}
                    </Text>
                  )}

                  <View style={styles.modalInputRow}>
                    <Text style={styles.modalCurrency}>₱</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={contributeAmount}
                      onChangeText={(t) => setContributeAmount(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                  </View>

                  {overGoal && (
                    <View style={styles.modalCapNote}>
                      <Ionicons name="information-circle-outline" size={14} color="#0369A1" />
                      <Text style={styles.modalCapNoteText}>
                        Only {formatCurrency(actual)} will be deducted — just enough to complete the goal.
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={() => setContributeModal(null)}
                      style={[styles.modalBtn, styles.modalBtnCancel]}
                    >
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleContribute}
                      disabled={isDisabled}
                      style={[styles.modalBtn, styles.modalBtnSave, isDisabled && { opacity: 0.4 }]}
                    >
                      <Text style={styles.modalBtnSaveText}>
                        {isSaving ? 'Saving…' : overGoal ? `Save ${formatCurrency(actual)}` : 'Save'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
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
  addBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  goalCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
  },
  goalProgress: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalPercent: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  contributeBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#6366F1',
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completeText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#16A34A',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    marginBottom: 16,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalRemaining: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#6366F1',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  modalCapNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  modalCapNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#0369A1',
    lineHeight: 17,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalCurrency: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: Colors.textTertiary,
    marginRight: 4,
  },
  modalInput: {
    fontSize: 36,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.surfaceAlt,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
  },
  modalBtnSave: {
    backgroundColor: '#6366F1',
  },
  modalBtnSaveText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
});
