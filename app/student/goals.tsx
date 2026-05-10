import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Platform, Alert, TextInput, Modal, ScrollView } from 'react-native';
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
  goal, onContribute, onDelete, onRedeem,
}: {
  goal: SavingsGoal;
  onContribute: (id: string) => void;
  onDelete: (id: string) => void;
  onRedeem: (goal: SavingsGoal) => void;
}) {
  const progress   = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const isComplete = progress >= 1;
  const countdown  = getCountdown(goal.deadline);
  const isOverdue  = countdown?.overdue ?? false;
  const isUrgent   = countdown?.urgent  ?? false;

  return (
    <View style={[styles.goalCard, goal.isLocked && styles.goalCardLocked]}>
      {/* Lock banner */}
      {goal.isLocked && (
        <View style={styles.lockBanner}>
          <Ionicons name="lock-closed" size={13} color="#92400E" />
          <Text style={styles.lockBannerText}>
            Locked by {goal.lockedBy || 'guardian'} — withdrawal disabled
          </Text>
        </View>
      )}

      <View style={styles.goalHeader}>
        <View style={[styles.goalIconCircle, {
          backgroundColor: isComplete ? '#DCFCE7' : goal.isLocked ? '#FEF3C7' : '#E0E7FF',
        }]}>
          <Ionicons
            name={(goal.iconName || 'flag') as any}
            size={24}
            color={isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#6366F1'}
          />
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
        {!goal.isLocked && (
          <Pressable onPress={() => onDelete(goal.id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, {
          width: `${Math.min(progress * 100, 100)}%` as any,
          backgroundColor: isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#6366F1',
        }]} />
      </View>

      <View style={styles.goalFooter}>
        <Text style={[styles.goalPercent, {
          color: isComplete ? '#16A34A' : goal.isLocked ? '#D97706' : '#6366F1',
        }]}>
          {Math.round(progress * 100)}%
        </Text>
        <View style={styles.footerActions}>
          {/* Redeem / partial withdraw — only if unlocked and has savings */}
          {!goal.isLocked && goal.currentAmount > 0 && (
            <Pressable
              onPress={() => onRedeem(goal)}
              style={({ pressed }) => [styles.redeemBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="arrow-down-circle" size={16} color="#16A34A" />
              <Text style={styles.redeemBtnText}>{isComplete ? 'Redeem' : 'Withdraw'}</Text>
            </Pressable>
          )}
          {!isComplete && !goal.isLocked && (
            <Pressable
              onPress={() => onContribute(goal.id)}
              style={({ pressed }) => [styles.contributeBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="add" size={16} color="#6366F1" />
              <Text style={styles.contributeBtnText}>Save</Text>
            </Pressable>
          )}
          {isComplete && (
            <View style={styles.completeBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
              <Text style={styles.completeText}>Complete!</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { savingsGoals, studentBalance, contributeToGoal, deleteSavingsGoal, redeemGoal } = useApp();

  const [contributeModal, setContributeModal] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount]   = useState('');
  const [redeemModal, setRedeemModal]             = useState<SavingsGoal | null>(null);
  const [redeemAmount, setRedeemAmount]           = useState('');
  const [isSaving, setIsSaving]                   = useState(false);

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const handleContribute = async () => {
    if (!contributeModal || isSaving) return;
    const val = parseFloat(contributeAmount);
    if (!val || val <= 0 || val > studentBalance) return;
    const activeGoal = savingsGoals.find(g => g.id === contributeModal);
    if (!activeGoal) return;
    const remaining = activeGoal.targetAmount - activeGoal.currentAmount;
    if (remaining <= 0) return;
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await contributeToGoal(contributeModal, val);
    setIsSaving(false);
    setContributeModal(null);
    setContributeAmount('');
  };

  const handleRedeem = async () => {
    if (!redeemModal || isSaving) return;
    const val = parseFloat(redeemAmount);
    if (!val || val <= 0 || val > redeemModal.currentAmount) return;
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const success = await redeemGoal(redeemModal.id, val);
    setIsSaving(false);
    setRedeemModal(null);
    setRedeemAmount('');
    if (!success) Alert.alert('Error', 'Could not redeem. Goal may be locked.');
  };

  const handleDelete = (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (goal?.isLocked) {
      Alert.alert('Locked', 'This goal is locked by your guardian and cannot be deleted.');
      return;
    }
    tap();
    Alert.alert(
      'Delete Goal',
      goal?.currentAmount && goal.currentAmount > 0
        ? `${formatCurrency(goal.currentAmount)} will be returned to your wallet.`
        : 'This goal will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSavingsGoal(goalId) },
      ]
    );
  };

  const openRedeemModal = (goal: SavingsGoal) => {
    if (goal.isLocked) return;
    tap();
    const isComplete = goal.currentAmount >= goal.targetAmount;
    // If complete, default to full amount; otherwise show partial withdraw
    setRedeemAmount(isComplete ? goal.currentAmount.toFixed(2) : '');
    setRedeemModal(goal);
  };

  return (
    <View style={styles.container}>
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
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <GoalCard
            goal={item}
            onContribute={id => { tap(); setContributeModal(id); setContributeAmount(''); }}
            onDelete={handleDelete}
            onRedeem={openRedeemModal}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No savings goals yet</Text>
            <Text style={styles.emptySubtext}>Set a goal and start saving toward it</Text>
            <Pressable onPress={() => router.push('/student/add-goal')}
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.createBtnText}>Create Goal</Text>
            </Pressable>
          </View>
        }
      />

      {/* ── Contribute Modal ── */}
      <Modal visible={!!contributeModal} transparent animationType="fade" onRequestClose={() => setContributeModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setContributeModal(null)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add to Savings</Text>
            {(() => {
              const g = savingsGoals.find(x => x.id === contributeModal);
              const remaining = g ? g.targetAmount - g.currentAmount : 0;
              const val = parseFloat(contributeAmount) || 0;
              const actual = Math.min(val, remaining);
              const overGoal = val > remaining && val > 0;
              return (
                <>
                  <Text style={styles.modalSubtitle}>Available: {formatCurrency(studentBalance)}</Text>
                  {g && <Text style={styles.modalRemaining}>Needed: {formatCurrency(remaining)}</Text>}
                  <View style={styles.modalInputRow}>
                    <Text style={styles.modalCurrency}>₱</Text>
                    <TextInput style={styles.modalInput} value={contributeAmount}
                      onChangeText={t => setContributeAmount(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00" placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad" autoFocus />
                  </View>
                  {overGoal && (
                    <View style={styles.capNote}>
                      <Ionicons name="information-circle-outline" size={14} color="#0369A1" />
                      <Text style={styles.capNoteText}>Only {formatCurrency(actual)} will be saved — just enough to complete the goal.</Text>
                    </View>
                  )}
                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setContributeModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleContribute} disabled={isSaving || val <= 0 || val > studentBalance}
                      style={[styles.modalBtn, styles.modalBtnSave, (isSaving || val <= 0 || val > studentBalance) && { opacity: 0.4 }]}>
                      <Text style={styles.modalBtnSaveText}>{isSaving ? 'Saving…' : overGoal ? `Save ${formatCurrency(actual)}` : 'Save'}</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Redeem / Withdraw Modal ── */}
      <Modal visible={!!redeemModal} transparent animationType="fade" onRequestClose={() => setRedeemModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRedeemModal(null)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            {redeemModal && (() => {
              const isComplete = redeemModal.currentAmount >= redeemModal.targetAmount;
              const val = parseFloat(redeemAmount) || 0;
              return (
                <>
                  <View style={styles.redeemHeader}>
                    <Ionicons name="arrow-down-circle" size={32} color="#16A34A" />
                    <Text style={styles.modalTitle}>{isComplete ? '🎉 Goal Complete!' : 'Withdraw Savings'}</Text>
                  </View>
                  {isComplete && (
                    <Text style={styles.redeemCongrats}>
                      You reached your goal for "{redeemModal.name}"! Redeem your savings back to your wallet.
                    </Text>
                  )}
                  {!isComplete && (
                    <Text style={styles.redeemWarning}>
                      ⚠️ Withdrawing before your goal is complete will set back your progress.
                    </Text>
                  )}
                  <Text style={styles.modalSubtitle}>
                    Saved: {formatCurrency(redeemModal.currentAmount)}
                  </Text>
                  <View style={styles.modalInputRow}>
                    <Text style={styles.modalCurrency}>₱</Text>
                    <TextInput style={styles.modalInput} value={redeemAmount}
                      onChangeText={t => setRedeemAmount(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00" placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad" autoFocus />
                  </View>
                  {val > redeemModal.currentAmount && (
                    <Text style={styles.errorText}>Amount exceeds your savings</Text>
                  )}
                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setRedeemModal(null)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={handleRedeem}
                      disabled={isSaving || val <= 0 || val > redeemModal.currentAmount}
                      style={[styles.modalBtn, styles.modalBtnRedeem, (isSaving || val <= 0 || val > redeemModal.currentAmount) && { opacity: 0.4 }]}>
                      <Text style={styles.modalBtnSaveText}>{isSaving ? 'Processing…' : isComplete ? 'Redeem to Wallet' : 'Withdraw'}</Text>
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
  container:          { flex: 1, backgroundColor: Colors.background },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  addBtn:             { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  list:               { paddingHorizontal: 24, paddingTop: 8 },
  goalCard:           { backgroundColor: Colors.white, borderRadius: 18, padding: 20, marginBottom: 14, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  goalCardLocked:     { borderWidth: 1.5, borderColor: '#FDE68A' },
  lockBanner:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  lockBannerText:     { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#92400E', flex: 1 },
  goalHeader:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  goalIconCircle:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  goalInfo:           { flex: 1 },
  goalNameRow:        { flexDirection: 'row', alignItems: 'center' },
  goalName:           { fontSize: 16, fontFamily: 'DMSans_700Bold', color: Colors.text },
  goalProgress:       { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  deadlineText:       { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#6366F1', marginTop: 3 },
  deadlineUrgent:     { color: '#D97706' },
  deadlineOverdue:    { color: '#DC2626' },
  deleteBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressBarBg:      { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressBarFill:    { height: '100%', borderRadius: 4 },
  goalFooter:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalPercent:        { fontSize: 16, fontFamily: 'DMSans_700Bold' },
  footerActions:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  contributeBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  contributeBtnText:  { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#6366F1' },
  redeemBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  redeemBtnText:      { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#16A34A' },
  completeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  completeText:       { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#16A34A' },
  empty:              { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText:          { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  emptySubtext:       { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginBottom: 16 },
  createBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366F1', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  createBtnText:      { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
  modalOverlay:       { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent:       { width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24 },
  redeemHeader:       { alignItems: 'center', gap: 8, marginBottom: 4 },
  modalTitle:         { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  redeemCongrats:     { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  redeemWarning:      { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#D97706', textAlign: 'center', marginBottom: 12, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10 },
  modalSubtitle:      { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, textAlign: 'center', marginBottom: 4 },
  modalRemaining:     { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#6366F1', textAlign: 'center', marginBottom: 12 },
  capNote:            { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F0F9FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#BAE6FD' },
  capNoteText:        { flex: 1, fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#0369A1', lineHeight: 17 },
  errorText:          { fontSize: 12, color: '#DC2626', textAlign: 'center', marginBottom: 8 },
  modalInputRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalCurrency:      { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  modalInput:         { fontSize: 36, fontFamily: 'DMSans_700Bold', color: Colors.text, minWidth: 80, textAlign: 'center' },
  modalActions:       { flexDirection: 'row', gap: 12 },
  modalBtn:           { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalBtnCancel:     { backgroundColor: Colors.surfaceAlt },
  modalBtnCancelText: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  modalBtnSave:       { backgroundColor: '#6366F1' },
  modalBtnRedeem:     { backgroundColor: '#16A34A' },
  modalBtnSaveText:   { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
});