import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, KeyboardAvoidingView, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';

const CATEGORIES = [
  { id: 'food', label: 'Food', icon: 'fast-food', color: '#F97316', bg: '#FFF7ED' },
  { id: 'transport', label: 'Transport', icon: 'bus', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'entertainment', label: 'Fun', icon: 'game-controller', color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'school', label: 'School', icon: 'book', color: '#9B1C1C', bg: '#F0FDFA' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280', bg: '#F9FAFB' },
];

export default function ExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { studentBalance, spendingLimit, todaySpent, addExpense } = useApp();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;

  const hasSpendingLimit = spendingLimit && spendingLimit.isActive && spendingLimit.dailyLimit > 0;
  const limitRemaining = hasSpendingLimit ? Math.max(spendingLimit!.dailyLimit - todaySpent, 0) : null;
  const wouldExceedLimit = hasSpendingLimit && (todaySpent + parsedAmount > spendingLimit!.dailyLimit);

  const isValid = parsedAmount > 0 && parsedAmount <= studentBalance && description.trim().length > 0 && !wouldExceedLimit;

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    const success = await addExpense(parsedAmount, description.trim(), category);
    setIsSubmitting(false);
    if (success) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Expense Blocked',
        'This expense would exceed your daily spending limit set by your guardian.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.balanceInfo}>
          <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.balanceText}>
            Balance: ₱{studentBalance.toFixed(2)}
          </Text>
        </View>

        {hasSpendingLimit && (
          <View style={[styles.limitInfo, limitRemaining === 0 && { backgroundColor: '#FEE2E2', borderColor: '#FCD34D' }]}>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={limitRemaining === 0 ? Colors.danger : '#D97706'}
            />
            <Text style={[styles.limitText, limitRemaining === 0 && { color: Colors.danger }]}>
              {limitRemaining === 0
                ? 'Daily limit reached'
                : `Daily limit: ${formatCurrency(limitRemaining!)} remaining`}
            </Text>
          </View>
        )}

        <View style={styles.amountSection}>
          <Text style={styles.currencySign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        {parsedAmount > studentBalance && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>Not enough balance</Text>
          </View>
        )}

        {parsedAmount > 0 && parsedAmount <= studentBalance && wouldExceedLimit && (
          <View style={styles.errorRow}>
            <Ionicons name="shield" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>
              Exceeds daily spending limit ({formatCurrency(limitRemaining!)}{' '}left)
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What did you spend on?</Text>
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Lunch at school cafeteria"
            placeholderTextColor={Colors.textTertiary}
            maxLength={100}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => { tap(); setCategory(cat.id); }}
                style={[
                  styles.catBtn,
                  category === cat.id && { borderColor: cat.color, borderWidth: 2 },
                ]}
              >
                <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={[styles.catText, category === cat.id && { color: cat.color, fontFamily: 'DMSans_700Bold' }]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            styles.submitBtn,
            !isValid && styles.submitBtnDisabled,
            pressed && isValid && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
          <Text style={styles.submitBtnText}>
            {isSubmitting ? 'Logging...' : 'Log Expense'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  closeBtn: {
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    marginBottom: 8,
  },
  balanceText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: Colors.textSecondary,
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  limitText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#92400E',
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  currencySign: {
    fontSize: 36,
    fontFamily: 'DMSans_700Bold',
    color: Colors.textTertiary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: Colors.danger,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descInput: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: Colors.text,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catBtn: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: '30%' as any,
    flex: 1,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: Colors.text,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
});
