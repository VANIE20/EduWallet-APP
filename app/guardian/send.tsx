import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import PinLock, { hasPinSet } from '../../components/PinLock';

function formatCurrency(amount: number): string {
  return '₱' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const { guardianBalance, sendAllowanceNow, linkedStudents, selectedStudentId, selectStudent } = useApp();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  // Local selected student — defaults to the globally selected one
  const [localStudentId, setLocalStudentId] = useState<string | null>(selectedStudentId);

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= guardianBalance && !!localStudentId;

  const selectedStudent = linkedStudents.find(s => s.id === localStudentId);
  const recipientName = selectedStudent?.displayName || 'Select a student';

  const doSend = async () => {
    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await sendAllowanceNow(parsedAmount, localStudentId || undefined);
    // Sync global selected student
    if (localStudentId) selectStudent(localStudentId);
    setIsSubmitting(false);
    router.back();
  };

  const handleSend = async () => {
    if (!isValid) return;
    const pinSet = await hasPinSet();
    if (pinSet) {
      setPinVisible(true);
    } else {
      doSend();
    }
  };

  const handleSelectStudent = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalStudentId(id);
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
        <Text style={styles.headerTitle}>Send Allowance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceInfo}>
          <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.balanceText}>Available: {formatCurrency(guardianBalance)}</Text>
        </View>

        <View style={styles.amountSection}>
          <Text style={styles.currencySign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        {parsedAmount > guardianBalance && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>Insufficient funds</Text>
          </View>
        )}

        {/* Student Selector */}
        <Text style={styles.sectionLabel}>SEND TO</Text>
        {linkedStudents.length === 0 ? (
          <View style={styles.noStudentCard}>
            <Ionicons name="person-outline" size={20} color={Colors.textTertiary} />
            <Text style={styles.noStudentText}>No linked students found</Text>
          </View>
        ) : (
          <View style={styles.studentList}>
            {linkedStudents.map((student) => {
              const isSelected = student.id === localStudentId;
              return (
                <Pressable
                  key={student.id}
                  onPress={() => handleSelectStudent(student.id)}
                  style={({ pressed }) => [
                    styles.studentRow,
                    isSelected && styles.studentRowActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={[styles.studentAvatar, isSelected && styles.studentAvatarActive]}>
                    <Ionicons name="school" size={20} color={isSelected ? Colors.white : Colors.primary} />
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, isSelected && styles.studentNameActive]}>
                      {student.displayName}
                    </Text>
                    <Text style={[styles.studentEmail, isSelected && styles.studentEmailActive]}>
                      {student.email}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSend}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            styles.sendBtn,
            !isValid && styles.sendBtnDisabled,
            pressed && isValid && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="send" size={20} color={Colors.white} />
          <Text style={styles.sendBtnText}>
            {isSubmitting
              ? 'Sending...'
              : !localStudentId
              ? 'Select a student'
              : `Send ${parsedAmount > 0 ? formatCurrency(parsedAmount) : ''} to ${selectedStudent?.displayName || ''}`}
          </Text>
        </Pressable>
      </View>

      <PinLock
        visible={pinVisible}
        mode="verify"
        accentColor={Colors.guardianGradientStart}
        onSuccess={() => { setPinVisible(false); doSend(); }}
        onDismiss={() => setPinVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  balanceInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Colors.surfaceAlt, borderRadius: 12, marginBottom: 8 },
  balanceText: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.textSecondary },
  amountSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  currencySign: { fontSize: 40, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  amountInput: { fontSize: 56, fontFamily: 'DMSans_700Bold', color: Colors.text, minWidth: 100, textAlign: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  errorText: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: Colors.danger },
  sectionLabel: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  studentList: { gap: 10 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  studentRowActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  studentAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  studentAvatarActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  studentNameActive: { color: Colors.white },
  studentEmail: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  studentEmailActive: { color: 'rgba(255,255,255,0.75)' },
  noStudentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  noStudentText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  sendBtn: { backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});