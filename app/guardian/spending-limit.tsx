import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Switch, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getSpendingLimit } from '../../lib/storage';

export default function SpendingLimitScreen() {
  const insets = useSafeAreaInsets();
  const { spendingLimit, updateSpendingLimit, todaySpent, selectedStudentId, linkedStudents, selectStudent, refreshData } = useApp();

  const [localStudentId, setLocalStudentId] = useState<string | null>(selectedStudentId);
  const [dailyLimit,  setDailyLimit]  = useState(spendingLimit?.dailyLimit?.toString() || '');
  const [isActive,    setIsActive]    = useState(spendingLimit?.isActive ?? false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [applyToAll,  setApplyToAll]  = useState(false);

  const parsedLimit = parseFloat(dailyLimit) || 0;
  const isValid = parsedLimit > 0;
  const selectedStudent = linkedStudents.find(s => s.id === localStudentId);
  const studentName = selectedStudent?.displayName || 'Student';

  // Load limit whenever the viewed student changes
  useEffect(() => {
    if (!localStudentId) return;
    setIsLoading(true);
    getSpendingLimit(localStudentId).then(limit => {
      setDailyLimit(limit?.dailyLimit?.toString() || '');
      setIsActive(limit?.isActive ?? false);
      setIsLoading(false);
    });
  }, [localStudentId]);

  const handleSelectStudent = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalStudentId(id);
    setApplyToAll(false);
  };

  const handleSave = async () => {
    if (!isValid && isActive) {
      Alert.alert('Invalid Limit', 'Please enter a valid daily limit amount.');
      return;
    }
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const safeDailyLimit = parsedLimit > 0 ? parsedLimit : (spendingLimit?.dailyLimit ?? 1);
    const config = { dailyLimit: safeDailyLimit, isActive };
    const studentsToSave = applyToAll ? linkedStudents : (localStudentId ? [{ id: localStudentId }] : []);

    // Save for each student one by one
    for (const s of studentsToSave) {
      await updateSpendingLimit(config, s.id);
    }

    // After ALL saves, refresh using the student we were viewing
    const refreshId = localStudentId ?? undefined;
    if (refreshId) {
      selectStudent(refreshId);
      await refreshData(refreshId);
    } else {
      await refreshData();
    }

    setIsSaving(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/guardian');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/guardian')} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Spending Limit</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Student Selector */}
        {linkedStudents.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SELECT STUDENT</Text>
            <View style={styles.studentList}>
              {linkedStudents.map((student) => {
                const isSel = student.id === localStudentId;
                return (
                  <Pressable key={student.id} onPress={() => handleSelectStudent(student.id)}
                    style={({ pressed }) => [styles.studentRow, isSel && styles.studentRowActive, pressed && { opacity: 0.85 }]}>
                    <View style={[styles.studentAvatar, isSel && styles.studentAvatarActive]}>
                      <Ionicons name="school" size={18} color={isSel ? Colors.white : Colors.primary} />
                    </View>
                    <Text style={[styles.studentName, isSel && styles.studentNameActive]}>{student.displayName}</Text>
                    {isSel && <Ionicons name="checkmark-circle" size={20} color={Colors.white} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <>
            <View style={styles.infoCard}>
              <View style={[styles.infoIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="shield-checkmark" size={28} color="#D97706" />
              </View>
              <Text style={styles.infoTitle}>Protect Against Overspending</Text>
              <Text style={styles.infoDesc}>
                Set a maximum daily spending limit for {studentName}. Expenses that would exceed this limit will be blocked.
              </Text>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Enable Spending Limit</Text>
                <Text style={styles.toggleHint}>{isActive ? 'Limit is active' : 'Limit is inactive'}</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={(val) => {
                  setIsActive(val);
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: '#E2E8F0', true: '#5EEAD4' }}
                thumbColor={isActive ? Colors.primary : '#CBD5E1'}
              />
            </View>

            {isActive && (
              <>
                <View style={styles.inputSection}>
                  <Text style={styles.sectionLabel}>DAILY LIMIT</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.currencySign}>₱</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={dailyLimit}
                      onChangeText={(t) => setDailyLimit(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.0"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={styles.todayCard}>
                  <View style={styles.todayRow}>
                    <View style={styles.todayLeft}>
                      <Ionicons name="today" size={18} color="#9B1C1C" />
                      <Text style={styles.todayLabel}>Spent Today</Text>
                    </View>
                    <Text style={styles.todayAmount}>₱{todaySpent.toFixed(2)}</Text>
                  </View>
                  {parsedLimit > 0 && (
                    <View style={styles.limitBarOuter}>
                      <View style={[styles.limitBarInner, {
                        width: `${Math.min((todaySpent / parsedLimit) * 100, 100)}%` as any,
                        backgroundColor: todaySpent >= parsedLimit ? Colors.danger : todaySpent >= parsedLimit * 0.8 ? Colors.warning : Colors.success,
                      }]} />
                    </View>
                  )}
                  {parsedLimit > 0 && (
                    <Text style={styles.limitRemaining}>
                      ₱{Math.max(parsedLimit - todaySpent, 0).toFixed(2)} remaining today
                    </Text>
                  )}
                </View>
              </>
            )}

            {linkedStudents.length > 1 && (
              <Pressable
                onPress={() => {
                  setApplyToAll(!applyToAll);
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.applyAllRow, applyToAll && styles.applyAllRowActive]}
              >
                <View style={styles.applyAllLeft}>
                  <Ionicons
                    name={applyToAll ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={applyToAll ? Colors.white : Colors.textTertiary}
                  />
                  <View>
                    <Text style={[styles.applyAllLabel, applyToAll && styles.applyAllLabelActive]}>
                      Apply to all students
                    </Text>
                    <Text style={[styles.applyAllHint, applyToAll && styles.applyAllHintActive]}>
                      This limit will be set for all {linkedStudents.length} linked students
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, isSaving && { opacity: 0.6 }]}
        >
          {isSaving
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
          }
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving…' : applyToAll ? `Save for All ${linkedStudents.length} Students` : `Save for ${studentName}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:           { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  content:            { flex: 1 },
  scrollContent:      { paddingHorizontal: 24 },
  section:            { marginBottom: 24 },
  sectionLabel:       { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  studentList:        { gap: 8 },
  studentRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  studentRowActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  studentAvatar:      { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  studentAvatarActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  studentName:        { flex: 1, fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  studentNameActive:  { color: Colors.white },
  infoCard:           { backgroundColor: Colors.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  infoIconBg:         { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  infoTitle:          { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  infoDesc:           { fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  toggleRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  toggleInfo:         { flex: 1 },
  toggleLabel:        { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  toggleHint:         { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  inputSection:       { marginBottom: 20 },
  amountRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  currencySign:       { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  amountInput:        { flex: 1, fontSize: 32, fontFamily: 'DMSans_700Bold', color: Colors.text },
  todayCard:          { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },
  todayRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  todayLeft:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayLabel:         { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  todayAmount:        { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text },
  limitBarOuter:      { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  limitBarInner:      { height: '100%', borderRadius: 4 },
  limitRemaining:     { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary },
  applyAllRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginTop: 4, borderWidth: 2, borderColor: Colors.border },
  applyAllRowActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  applyAllLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  applyAllLabel:      { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  applyAllLabelActive:{ color: Colors.white },
  applyAllHint:       { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  applyAllHintActive: { color: 'rgba(255,255,255,0.75)' },
  footer:             { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Colors.background },
  saveBtn:            { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText:        { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});