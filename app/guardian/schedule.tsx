import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView, Switch, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';
import { getAllowanceConfig } from '../../lib/storage';
import type { AllowanceConfig } from '../../lib/storage';

const FREQUENCIES: { label: string; value: AllowanceConfig['frequency'] }[] = [
  { label: 'Daily',     value: 'daily'    },
  { label: 'Weekly',    value: 'weekly'   },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly',   value: 'monthly'  },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { updateAllowanceConfig, selectStudent, refreshData, selectedStudentId, linkedStudents } = useApp();

  const [localStudentId,  setLocalStudentId]  = useState<string | null>(selectedStudentId);
  const [amount,          setAmount]          = useState('');
  const [frequency,       setFrequency]       = useState<AllowanceConfig['frequency']>('weekly');
  const [dayOfWeek,       setDayOfWeek]       = useState(1);
  const [sendHour,        setSendHour]        = useState(8);
  const [isActive,        setIsActive]        = useState(true);
  const [isLoading,       setIsLoading]       = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [applyToAll,      setApplyToAll]      = useState(false);
  const [showTimePicker,  setShowTimePicker]  = useState(false);

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  useEffect(() => {
    if (!localStudentId) return;
    setIsLoading(true);
    getAllowanceConfig(localStudentId).then(cfg => {
      setAmount(cfg?.amount?.toString() || '');
      setFrequency(cfg?.frequency || 'weekly');
      setDayOfWeek(cfg?.dayOfWeek ?? 1);
      setSendHour(cfg?.sendHour ?? 8);
      setIsActive(cfg?.isActive ?? true);
      setIsLoading(false);
    });
  }, [localStudentId]);

  const handleSelectStudent = (id: string) => {
    tap();
    setLocalStudentId(id);
    setApplyToAll(false);
  };

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid allowance amount.');
      return;
    }
    setIsSaving(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const config: AllowanceConfig = { amount: val, frequency, dayOfWeek, sendHour, isActive };
    const studentsToSave = applyToAll ? linkedStudents : (localStudentId ? [{ id: localStudentId }] : []);

    for (const s of studentsToSave) {
      await updateAllowanceConfig(config, s.id);
    }

    const refreshId = localStudentId ?? undefined;
    if (refreshId) {
      selectStudent(refreshId);
      await refreshData(refreshId);
    } else {
      await refreshData();
    }

    setIsSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/guardian');
  };

  const selectedStudent = linkedStudents.find(s => s.id === localStudentId);
  const studentName = selectedStudent?.displayName || 'Student';
  const isValid = parseFloat(amount) > 0;
  const sendTimeLabel = HOURS[sendHour]?.label ?? '8:00 AM';

  const getNextSendLabel = (): string => {
    const now = new Date();
    const candidate = new Date();
    candidate.setHours(sendHour, 0, 0, 0);

    if (frequency === 'daily') {
      if (now >= candidate) candidate.setDate(candidate.getDate() + 1);
    } else if (frequency === 'weekly' || frequency === 'biweekly') {
      const daysUntil = (dayOfWeek - now.getDay() + 7) % 7 || 7;
      candidate.setDate(now.getDate() + daysUntil);
    } else {
      candidate.setMonth(candidate.getMonth() + 1, 1);
    }

    const isToday = candidate.toDateString() === now.toDateString();
    const isTomorrow = candidate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    const dayStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow'
      : candidate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `${dayStr} at ${sendTimeLabel}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/guardian')} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Auto-Allowance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}
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
            {/* Enable toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="time" size={22} color={Colors.primary} />
                <Text style={styles.toggleLabel}>Enable Auto-Allowance</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={(val) => { tap(); setIsActive(val); }}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amount per period</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySign}>₱</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Frequency */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Frequency</Text>
              <View style={styles.freqGrid}>
                {FREQUENCIES.map((f) => (
                  <Pressable key={f.value} onPress={() => { tap(); setFrequency(f.value); }}
                    style={[styles.freqBtn, frequency === f.value && styles.freqBtnActive]}>
                    <Text style={[styles.freqText, frequency === f.value && styles.freqTextActive]}>{f.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Day of week */}
            {(frequency === 'weekly' || frequency === 'biweekly') && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Day of week</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((day, idx) => (
                    <Pressable key={day} onPress={() => { tap(); setDayOfWeek(idx); }}
                      style={[styles.dayBtn, dayOfWeek === idx && styles.dayBtnActive]}>
                      <Text style={[styles.dayText, dayOfWeek === idx && styles.dayTextActive]}>{day}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Send time — single tappable row */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Send time</Text>
              <Pressable
                onPress={() => { tap(); setShowTimePicker(true); }}
                style={({ pressed }) => [styles.timeRow, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.timeRowLeft}>
                  <View style={styles.timeIconWrap}>
                    <Ionicons name="alarm-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.timeRowLabel}>Allowance sends at</Text>
                </View>
                <View style={styles.timeRowRight}>
                  <Text style={styles.timeRowValue}>{sendTimeLabel}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </View>
              </Pressable>
            </View>

            {/* Next send preview */}
            {isActive && isValid && (
              <View style={styles.nextSendCard}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextSendTitle}>Next auto-send</Text>
                  <Text style={styles.nextSendValue}>{getNextSendLabel()}</Text>
                </View>
              </View>
            )}

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.summaryText}>
                {isActive
                  ? `${applyToAll ? 'All students' : studentName} will receive ₱${parseFloat(amount) || 0} ${frequency} at ${sendTimeLabel} automatically.`
                  : 'Auto-allowance is currently paused.'}
              </Text>
            </View>

            {/* Apply to all */}
            {linkedStudents.length > 1 && (
              <Pressable onPress={() => { tap(); setApplyToAll(!applyToAll); }}
                style={[styles.applyAllRow, applyToAll && styles.applyAllRowActive]}>
                <View style={styles.applyAllLeft}>
                  <Ionicons
                    name={applyToAll ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={applyToAll ? Colors.white : Colors.textTertiary}
                  />
                  <View>
                    <Text style={[styles.applyAllLabel, applyToAll && styles.applyAllLabelActive]}>Apply to all students</Text>
                    <Text style={[styles.applyAllHint, applyToAll && styles.applyAllHintActive]}>
                      Same schedule for all {linkedStudents.length} linked students
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable
          onPress={handleSave}
          disabled={!isValid || isSaving}
          style={({ pressed }) => [styles.saveBtn, (!isValid || isSaving) && styles.saveBtnDisabled, pressed && isValid && { opacity: 0.9 }]}
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

      {/* Time picker modal */}
      <Modal
        visible={showTimePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimePicker(false)}>
          <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose a time</Text>
            <FlatList
              data={HOURS}
              keyExtractor={(h) => h.value.toString()}
              showsVerticalScrollIndicator={false}
              style={styles.hourList}
              renderItem={({ item }) => {
                const selected = item.value === sendHour;
                return (
                  <Pressable
                    onPress={() => { tap(); setSendHour(item.value); setShowTimePicker(false); }}
                    style={({ pressed }) => [styles.hourRow, selected && styles.hourRowActive, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[styles.hourLabel, selected && styles.hourLabelActive]}>{item.label}</Text>
                    {selected && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.background },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:         { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  content:             { flex: 1 },
  scrollContent:       { padding: 24 },
  section:             { marginBottom: 24 },
  sectionLabel:        { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  studentList:         { gap: 8 },
  studentRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  studentRowActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  studentAvatar:       { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  studentAvatarActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  studentName:         { flex: 1, fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  studentNameActive:   { color: Colors.white },
  toggleRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 24 },
  toggleInfo:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel:         { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  amountRow:           { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16 },
  currencySign:        { fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  amountInput:         { flex: 1, fontSize: 32, fontFamily: 'DMSans_700Bold', color: Colors.text },
  freqGrid:            { flexDirection: 'row', gap: 10 },
  freqBtn:             { flex: 1, backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  freqBtnActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  freqText:            { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  freqTextActive:      { color: Colors.white },
  daysRow:             { flexDirection: 'row', gap: 8 },
  dayBtn:              { flex: 1, backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  dayBtnActive:        { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText:             { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  dayTextActive:       { color: Colors.white },
  timeRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 16, padding: 16 },
  timeRowLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeIconWrap:        { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  timeRowLabel:        { fontSize: 15, fontFamily: 'DMSans_500Medium', color: Colors.text },
  timeRowRight:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeRowValue:        { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.primary },
  nextSendCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#DDD6FE', marginBottom: 16 },
  nextSendTitle:       { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.4 },
  nextSendValue:       { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#5B21B6', marginTop: 2 },
  summaryCard:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F0FDFA', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16 },
  summaryText:         { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.textSecondary, lineHeight: 20 },
  applyAllRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: Colors.border },
  applyAllRowActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  applyAllLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  applyAllLabel:       { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  applyAllLabelActive: { color: Colors.white },
  applyAllHint:        { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, marginTop: 2 },
  applyAllHintActive:  { color: 'rgba(255,255,255,0.75)' },
  footer:              { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Colors.background },
  saveBtn:             { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnDisabled:     { opacity: 0.4 },
  saveBtnText:         { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:          { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, maxHeight: '70%' },
  modalHandle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle:          { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text, marginBottom: 16 },
  hourList:            { flexGrow: 0 },
  hourRow:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  hourRowActive:       { backgroundColor: Colors.primaryLight + '33', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  hourLabel:           { fontSize: 16, fontFamily: 'DMSans_500Medium', color: Colors.text },
  hourLabelActive:     { fontFamily: 'DMSans_700Bold', color: Colors.primary },
});