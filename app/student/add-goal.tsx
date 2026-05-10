import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ScrollView, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';

const ICONS = [
  { name: 'headset', label: 'Headphones' }, { name: 'phone-portrait', label: 'Phone' },
  { name: 'laptop',  label: 'Laptop' },     { name: 'bicycle',        label: 'Bike' },
  { name: 'game-controller', label: 'Games' }, { name: 'book',        label: 'Books' },
  { name: 'shirt',   label: 'Clothes' },    { name: 'gift',           label: 'Gift' },
  { name: 'airplane',label: 'Travel' },     { name: 'musical-notes',  label: 'Music' },
  { name: 'camera',  label: 'Camera' },     { name: 'flag',           label: 'Other' },
];

// ── Date helpers ─────────────────────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const MAX_DATE = new Date(TODAY);
MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 20);

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// Smart countdown: "X days remaining" for <60 days, "X months remaining" otherwise
function getCountdown(iso: string): { label: string; urgent: boolean; overdue: boolean } {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs   = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0)  return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`, urgent: false, overdue: true };
  if (diffDays === 0) return { label: 'Due today!', urgent: true, overdue: false };
  if (diffDays < 60)  return { label: `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`, urgent: diffDays <= 7, overdue: false };

  const months = Math.round(diffDays / 30.44);
  return { label: `${months} month${months !== 1 ? 's' : ''} remaining`, urgent: false, overdue: false };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Date Picker Modal ────────────────────────────────────────────────────────
function DatePickerModal({
  visible, current, onConfirm, onClose,
}: {
  visible: boolean;
  current: string | null;
  onConfirm: (iso: string) => void;
  onClose: () => void;
}) {
  const init = current
    ? (() => { const [y,m,d] = current.split('-').map(Number); return { y, m, d }; })()
    : { y: TODAY.getFullYear(), m: TODAY.getMonth() + 1, d: TODAY.getDate() };

  const [selY, setSelY] = useState(init.y);
  const [selM, setSelM] = useState(init.m);
  const [selD, setSelD] = useState(init.d);

  // clamp day when month/year changes
  const maxD = daysInMonth(selY, selM);
  const clampedD = Math.min(selD, maxD);

  const isoVal = toISO(selY, selM, clampedD);
  const [yv, mv, dv] = isoVal.split('-').map(Number);
  const selDate = new Date(yv, mv - 1, dv);
  selDate.setHours(0,0,0,0);

  const isPast    = selDate < TODAY;
  const isTooFar  = selDate > MAX_DATE;
  const isInvalid = isPast || isTooFar;

  function changeYear(delta: number) {
    const ny = selY + delta;
    if (ny < TODAY.getFullYear()) return;
    if (ny > MAX_DATE.getFullYear()) return;
    setSelY(ny);
  }

  function changeMonth(delta: number) {
    let nm = selM + delta;
    let ny = selY;
    if (nm < 1)  { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1;  ny += 1; }
    if (ny < TODAY.getFullYear()) return;
    if (ny > MAX_DATE.getFullYear()) return;
    setSelM(nm);
    setSelY(ny);
  }

  const days = Array.from({ length: maxD }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={dp.overlay} onPress={onClose}>
        <Pressable style={dp.sheet} onPress={e => e.stopPropagation()}>
          <Text style={dp.title}>Pick a Deadline</Text>
          <Text style={dp.sub}>Max 20 years · Cannot set past dates</Text>

          {/* Year row */}
          <View style={dp.spinnerRow}>
            <Text style={dp.spinnerLabel}>Year</Text>
            <View style={dp.spinner}>
              <Pressable onPress={() => changeYear(-1)} style={dp.arrow}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </Pressable>
              <Text style={dp.spinnerVal}>{selY}</Text>
              <Pressable onPress={() => changeYear(1)} style={dp.arrow}>
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Month row */}
          <View style={dp.spinnerRow}>
            <Text style={dp.spinnerLabel}>Month</Text>
            <View style={dp.spinner}>
              <Pressable onPress={() => changeMonth(-1)} style={dp.arrow}>
                <Ionicons name="chevron-back" size={20} color={Colors.text} />
              </Pressable>
              <Text style={dp.spinnerVal}>{MONTHS[selM - 1]}</Text>
              <Pressable onPress={() => changeMonth(1)} style={dp.arrow}>
                <Ionicons name="chevron-forward" size={20} color={Colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Day grid */}
          <View style={dp.spinnerRow}>
            <Text style={dp.spinnerLabel}>Day</Text>
          </View>
          <View style={dp.dayGrid}>
            {days.map(d => {
              const iso   = toISO(selY, selM, d);
              const [dy, dm, dd] = iso.split('-').map(Number);
              const dt    = new Date(dy, dm - 1, dd);
              dt.setHours(0,0,0,0);
              const past  = dt < TODAY;
              const far   = dt > MAX_DATE;
              const sel   = d === clampedD;
              return (
                <Pressable
                  key={d}
                  onPress={() => !past && !far && setSelD(d)}
                  style={[dp.dayBtn, sel && dp.dayBtnSel, (past || far) && dp.dayBtnDis]}
                  disabled={past || far}
                >
                  <Text style={[dp.dayNum, sel && dp.dayNumSel, (past || far) && dp.dayNumDis]}>
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Preview */}
          {!isInvalid && (
            <View style={dp.preview}>
              <Ionicons name="calendar" size={14} color="#D97706" />
              <Text style={dp.previewText}>{formatDate(isoVal)}</Text>
              <Text style={[dp.countdown,
                getCountdown(isoVal).overdue && { color: '#DC2626' },
                getCountdown(isoVal).urgent  && { color: '#D97706' },
              ]}>
                · {getCountdown(isoVal).label}
              </Text>
            </View>
          )}
          {isPast && (
            <View style={dp.errRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={dp.errText}>Cannot set a past date</Text>
            </View>
          )}
          {isTooFar && (
            <View style={dp.errRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={dp.errText}>Maximum deadline is 20 years from today</Text>
            </View>
          )}

          <View style={dp.actions}>
            <Pressable onPress={onClose} style={[dp.btn, dp.btnCancel]}>
              <Text style={dp.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (!isInvalid) { onConfirm(isoVal); onClose(); } }}
              disabled={isInvalid}
              style={[dp.btn, dp.btnConfirm, isInvalid && { opacity: 0.4 }]}
            >
              <Text style={dp.btnConfirmText}>Set Deadline</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function AddGoalScreen() {
  const insets = useSafeAreaInsets();
  const { addSavingsGoal } = useApp();

  const [name,         setName]         = useState('');
  const [target,       setTarget]       = useState('');
  const [selectedIcon, setSelectedIcon] = useState('flag');
  const [deadline,     setDeadline]     = useState<string | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedTarget = parseFloat(target) || 0;
  const isValid = name.trim().length > 0 && parsedTarget > 0;
  const countdown = deadline ? getCountdown(deadline) : null;

  const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const handleCreate = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addSavingsGoal(name.trim(), parsedTarget, selectedIcon, deadline);
    setIsSubmitting(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Goal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Goal Name</Text>
          <TextInput style={styles.textInput} value={name} onChangeText={setName}
            placeholder="e.g., New Headphones" placeholderTextColor={Colors.textTertiary} maxLength={50} />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySign}>₱</Text>
            <TextInput style={styles.amountInput} value={target}
              onChangeText={t => setTarget(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.0" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />
          </View>
        </View>

        {/* Deadline */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Deadline <Text style={styles.optional}>(optional)</Text>
          </Text>

          {/* Trigger button */}
          <Pressable
            onPress={() => { tap(); setShowPicker(true); }}
            style={({ pressed }) => [styles.dateBtn, deadline && styles.dateBtnSet, pressed && { opacity: 0.8 }]}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={deadline ? '#D97706' : Colors.textTertiary}
            />
            <Text style={[styles.dateBtnText, deadline && styles.dateBtnTextSet]}>
              {deadline ? formatDate(deadline) : 'Choose a date…'}
            </Text>
            {deadline && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); tap(); setDeadline(null); }}
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={18} color="#D97706" />
              </Pressable>
            )}
          </Pressable>

          {/* Countdown badge */}
          {deadline && countdown && (
            <View style={[
              styles.countdownBadge,
              countdown.overdue && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
              countdown.urgent  && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
            ]}>
              <Ionicons
                name={countdown.overdue ? 'alert-circle' : 'time-outline'}
                size={14}
                color={countdown.overdue ? '#DC2626' : countdown.urgent ? '#D97706' : '#D97706'}
              />
              <Text style={[
                styles.countdownText,
                countdown.overdue && { color: '#DC2626' },
                countdown.urgent  && { color: '#D97706' },
              ]}>
                {countdown.label}
              </Text>
            </View>
          )}
        </View>

        {/* Icon */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose an Icon</Text>
          <View style={styles.iconGrid}>
            {ICONS.map(icon => (
              <Pressable key={icon.name} onPress={() => { tap(); setSelectedIcon(icon.name); }}
                style={[styles.iconBtn, selectedIcon === icon.name && styles.iconBtnActive]}>
                <Ionicons name={icon.name as any} size={24}
                  color={selectedIcon === icon.name ? '#D97706' : Colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable onPress={handleCreate} disabled={!isValid || isSubmitting}
          style={({ pressed }) => [styles.createBtn, !isValid && styles.createBtnDisabled, pressed && isValid && { opacity: 0.9 }]}>
          <Ionicons name="flag" size={20} color={Colors.white} />
          <Text style={styles.createBtnText}>{isSubmitting ? 'Creating…' : 'Create Goal'}</Text>
        </Pressable>
      </View>

      <DatePickerModal
        visible={showPicker}
        current={deadline}
        onConfirm={setDeadline}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  closeBtn:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  scrollView:       { flex: 1 },
  content:          { paddingHorizontal: 24 },
  section:          { marginBottom: 24 },
  sectionLabel:     { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  optional:         { fontFamily: 'DMSans_400Regular', textTransform: 'none', fontSize: 12, color: Colors.textTertiary },
  textInput:        { backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, fontFamily: 'DMSans_400Regular', color: Colors.text },
  amountRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  currencySign:     { fontSize: 24, fontFamily: 'DMSans_700Bold', color: Colors.textTertiary, marginRight: 4 },
  amountInput:      { flex: 1, fontSize: 28, fontFamily: 'DMSans_700Bold', color: Colors.text },

  dateBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: Colors.border },
  dateBtnSet:       { borderColor: '#D97706', backgroundColor: '#FEF3C7' },
  dateBtnText:      { flex: 1, fontSize: 15, fontFamily: 'DMSans_500Medium', color: Colors.textTertiary },
  dateBtnTextSet:   { color: '#D97706' },

  countdownBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#C7D2FE' },
  countdownText:    { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#D97706' },

  iconGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn:          { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  iconBtnActive:    { borderColor: '#D97706', backgroundColor: '#FEF3C7' },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Colors.background },
  createBtn:        { backgroundColor: '#D97706', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createBtnDisabled:{ opacity: 0.4 },
  createBtnText:    { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});

// ── Date picker styles ───────────────────────────────────────────────────────
const dp = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  title:         { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  sub:           { fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary, textAlign: 'center', marginBottom: 20 },

  spinnerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  spinnerLabel:  { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary, width: 52 },
  spinner:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: 14, paddingVertical: 10 },
  arrow:         { paddingHorizontal: 18, paddingVertical: 4 },
  spinnerVal:    { fontSize: 18, fontFamily: 'DMSans_700Bold', color: Colors.text, minWidth: 70, textAlign: 'center' },

  dayGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  dayBtn:        { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dayBtnSel:     { backgroundColor: '#D97706' },
  dayBtnDis:     { opacity: 0.25 },
  dayNum:        { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  dayNumSel:     { color: '#fff' },
  dayNumDis:     { color: Colors.textTertiary },

  preview:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  previewText:   { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#B45309' },
  countdown:     { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#D97706' },

  errRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  errText:       { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#DC2626' },

  actions:       { flexDirection: 'row', gap: 12, marginTop: 6 },
  btn:           { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnCancel:     { backgroundColor: Colors.surfaceAlt },
  btnConfirm:    { backgroundColor: '#D97706' },
  btnCancelText: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  btnConfirmText:{ fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#fff' },
});