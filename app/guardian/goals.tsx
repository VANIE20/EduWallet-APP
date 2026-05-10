import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import type { SavingsGoal } from '../../lib/storage';

function formatCurrency(n: number) {
  return '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


function getCountdown(deadline: string | null | undefined): { label: string; urgent: boolean; overdue: boolean } | null {
  if (!deadline) return null;
  const [y, m, d] = deadline.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0)   return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`, urgent: false, overdue: true };
  if (diffDays === 0) return { label: 'Due today!', urgent: true, overdue: false };
  if (diffDays < 60)  return { label: `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`, urgent: diffDays <= 7, overdue: false };
  const months = Math.round(diffDays / 30.44);
  return { label: `${months} month${months !== 1 ? 's' : ''} remaining`, urgent: false, overdue: false };
}


function GoalCard({
  goal, onLockToggle, onCoContribute, onDelete,
}: {
  goal: SavingsGoal;
  onLockToggle: (goal: SavingsGoal) => void;
  onCoContribute: (goal: SavingsGoal) => void;
  onDelete: (id: string) => void;
}) {
  const progress   = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const isComplete = progress >= 1;
  const countdown  = getCountdown(goal.deadline);
  const isOverdue  = countdown?.overdue ?? false;
  const isUrgent   = countdown?.urgent  ?? false;

  return (
    <View style={[styles.goalCard, goal.isLocked && styles.goalCardLocked]}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalIconCircle, {
          backgroundColor: isComplete ? '#DCFCE7' : goal.isLocked ? '#FEF3C7' : '#FFF7ED',
        }]}>
          <Ionicons name={(goal.iconName || 'flag') as any} size={24}
            color={isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#9B1C1C'} />
        </View>
        <View style={styles.goalInfo}>
          <View style={styles.goalNameRow}>
            <Text style={styles.goalName}>{goal.name}</Text>
            {goal.isLocked && <Ionicons name="lock-closed" size={14} color="#D97706" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={styles.goalProgress}>
            {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
          </Text>
          {countdown && (
            <Text style={[styles.deadlineText, isOverdue && styles.deadlineOverdue, isUrgent && !isOverdue && styles.deadlineUrgent]}>
              {countdown.label}
            </Text>
          )}
        </View>
        <Pressable onPress={() => onDelete(goal.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, {
          width: `${Math.min(progress * 100, 100)}%` as any,
          backgroundColor: isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#9B1C1C',
        }]} />
      </View>

      <View style={styles.goalFooter}>
        <Text style={[styles.goalPercent, {
          color: isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#9B1C1C',
        }]}>
          {Math.round(progress * 100)}%
        </Text>
        <View style={styles.footerActions}>
          {/* Co-contribute button */}
          {!isComplete && (
            <Pressable onPress={() => onCoContribute(goal)}
              style={({ pressed }) => [styles.coContributeBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="gift" size={15} color="#9B1C1C" />
              <Text style={styles.coContributeBtnText}>Bonus</Text>
            </Pressable>
          )}
          {/* Lock/Unlock toggle */}
          <Pressable onPress={() => onLockToggle(goal)}
            style={({ pressed }) => [
              styles.lockBtn,
              goal.isLocked ? styles.lockBtnActive : styles.lockBtnInactive,
              pressed && { opacity: 0.7 },
            ]}>
            <Ionicons name={goal.isLocked ? 'lock-closed' : 'lock-open'} size={15}
              color={goal.isLocked ? '#92400E' : Colors.textSecondary} />
            <Text style={[styles.lockBtnText, goal.isLocked && styles.lockBtnTextActive]}>
              {goal.isLocked ? 'Locked' : 'Lock'}
            </Text>
          </Pressable>
          {isComplete && (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
              <Text style={styles.completeText}>Done!</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GuardianGoalsScreen() {
  const insets = useSafeAreaInsets();
  const { savingsGoals, guardianBalance, deleteSavingsGoal, lockGoal, unlockGoal, coContributeToGoal } = useApp();

  const [coModal, setCoModal]       = useState<SavingsGoal | null>(null);
  const [coAmount, setCoAmount]     = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  const remaining = coModal ? coModal.targetAmount - coModal.currentAmount : 0;
  const maxBonus  = coModal ? Math.min(remaining, guardianBalance) : 0;

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const handleLockToggle = (goal: SavingsGoal) => {
    tap();
    if (goal.isLocked) {
      Alert.alert('Unlock Goal?', `Allow "${goal.name}" withdrawals again?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock', onPress: () => unlockGoal(goal.id) },
      ]);
    } else {
      Alert.alert('Lock Goal?', `The student won't be able to withdraw from "${goal.name}" while it's locked.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Lock It', onPress: () => lockGoal(goal.id) },
      ]);
    }
  };

  const handleCoContribute = async () => {
    if (!coModal || isSaving) return;
    const val = parseFloat(coAmount);
    if (!val || val <= 0 || val > guardianBalance || val > remaining) return;
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await coContributeToGoal(coModal.id, val);
    setIsSaving(false);
    setCoModal(null);
    setCoAmount('');
    if (!success) Alert.alert('Error', 'Could not add bonus — check your wallet balance.');
  };

  const handleDelete = (goalId: string) => {
    tap();
    Alert.alert('Delete Goal', 'This will permanently delete the goal.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSavingsGoal(goalId) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Savings Goals</Text>
        <Pressable onPress={() => { tap(); router.push('/guardian/add-goal'); }} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#9B1C1C" />
        </Pressable>
      </View>

      <FlatList
        data={savingsGoals}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onLockToggle={handleLockToggle}
            onCoContribute={g => { tap(); setCoModal(g); setCoAmount(''); }}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No savings goals yet</Text>
            <Text style={styles.emptySubtext}>Your student hasn't set any goals</Text>
          </View>
        }
      />

      {/* ── Co-contribute Modal ── */}
      <Modal visible={!!coModal} transparent animationType="fade" onRequestClose={() => setCoModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCoModal(null)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.coHeader}>
              <Ionicons name="gift" size={32} color="#9B1C1C" />
              <Text style={styles.modalTitle}>Add a Bonus</Text>
            </View>
            {coModal && (
              <Text style={styles.coGoalName}>toward "{coModal.name}"</Text>
            )}
            <Text style={styles.modalSubtitle}>
              Your wallet: {formatCurrency(guardianBalance)}{'  ·  '}Goal needs: {formatCurrency(remaining)}
            </Text>
            <Text style={styles.modalMaxHint}>Max you can add: {formatCurrency(maxBonus)}</Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalCurrency}>₱</Text>
              <TextInput style={styles.modalInput} value={coAmount}
                onChangeText={t => setCoAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder="0.00" placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad" autoFocus />
            </View>
            {parseFloat(coAmount) > guardianBalance && (
              <Text style={styles.errorText}>Exceeds your wallet balance</Text>
            )}
            {parseFloat(coAmount) > remaining && parseFloat(coAmount) <= guardianBalance && (
              <Text style={styles.errorText}>Exceeds what the goal still needs ({formatCurrency(remaining)})</Text>
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCoModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCoContribute}
                disabled={isSaving || !parseFloat(coAmount) || parseFloat(coAmount) > guardianBalance || parseFloat(coAmount) > remaining}
                style={[styles.modalBtn, styles.modalBtnSave, (isSaving || !parseFloat(coAmount) || parseFloat(coAmount) > guardianBalance || parseFloat(coAmount) > remaining) && { opacity: 0.4 }]}>
                <Text style={styles.modalBtnSaveText}>{isSaving ? 'Sending…' : '🎁 Send Bonus'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: Colors.background },
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:                { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:            { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  addBtn:                 { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  list:                   { paddingHorizontal: 24, paddingTop: 8 },
  goalCard:               { backgroundColor: Colors.white, borderRadius: 18, padding: 20, marginBottom: 14, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  goalCardLocked:         { borderWidth: 1.5, borderColor: '#FDE68A' },
  goalHeader:             { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  goalIconCircle:         { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  goalInfo:               { flex: 1 },
  goalNameRow:            { flexDirection: 'row', alignItems: 'center' },
  goalName:               { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text },
  goalProgress:           { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  deadlineText:           { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#6366F1', marginTop: 3 },
  deadlineUrgent:         { color: '#D97706' },
  deadlineOverdue:        { color: '#DC2626' },
  deleteBtn:              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressBarBg:          { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressBarFill:        { height: '100%', borderRadius: 4 },
  goalFooter:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalPercent:            { fontSize: 16, fontFamily: 'DMSans_700Bold' },
  footerActions:          { flexDirection: 'row', gap: 8, alignItems: 'center' },
  coContributeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  coContributeBtnText:    { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#9B1C1C' },
  lockBtn:                { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  lockBtnInactive:        { backgroundColor: '#F1F5F9' },
  lockBtnActive:          { backgroundColor: '#FEF3C7' },
  lockBtnText:            { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  lockBtnTextActive:      { color: '#92400E' },
  completeBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  completeText:           { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#16A34A' },
  empty:                  { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText:              { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  emptySubtext:           { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  modalOverlay:           { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent:           { width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24 },
  coHeader:               { alignItems: 'center', gap: 8, marginBottom: 4 },
  modalTitle:             { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 2 },
  coGoalName:             { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  modalSubtitle:          { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, textAlign: 'center', marginBottom: 4 },
  modalMaxHint:           { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#9B1C1C', textAlign: 'center', marginBottom: 14 },
  modalInputRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalCurrency:          { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  modalInput:             { fontSize: 36, fontFamily: 'DMSans_700Bold', color: Colors.text, minWidth: 80, textAlign: 'center' },
  errorText:              { fontSize: 12, color: '#DC2626', textAlign: 'center', marginBottom: 8 },
  modalActions:           { flexDirection: 'row', gap: 12 },
  modalBtn:               { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalBtnCancel:         { backgroundColor: Colors.surfaceAlt },
  modalBtnCancelText:     { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  modalBtnSave:           { backgroundColor: '#9B1C1C' },
  modalBtnSaveText:       { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
});