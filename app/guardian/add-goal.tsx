import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';

const ICONS = [
  { name: 'headset', label: 'Headphones' }, { name: 'phone-portrait', label: 'Phone' },
  { name: 'laptop', label: 'Laptop' },       { name: 'bicycle', label: 'Bike' },
  { name: 'game-controller', label: 'Games' },{ name: 'book', label: 'Books' },
  { name: 'shirt', label: 'Clothes' },       { name: 'gift', label: 'Gift' },
  { name: 'airplane', label: 'Travel' },     { name: 'musical-notes', label: 'Music' },
  { name: 'camera', label: 'Camera' },       { name: 'flag', label: 'Other' },
];

const DEADLINE_PRESETS = [
  { label: '1 week',   days: 7  },
  { label: '2 weeks',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '3 months', days: 90 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AddGoalScreen() {
  const insets = useSafeAreaInsets();
  const { addSavingsGoal } = useApp();
  const [name,         setName]         = useState('');
  const [target,       setTarget]       = useState('');
  const [selectedIcon, setSelectedIcon] = useState('flag');
  const [deadline,     setDeadline]     = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedTarget = parseFloat(target) || 0;
  const isValid = name.trim().length > 0 && parsedTarget > 0;

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

      <ScrollView style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Goal Name</Text>
          <TextInput style={styles.textInput} value={name} onChangeText={setName}
            placeholder="e.g., New Headphones" placeholderTextColor={Colors.textTertiary} maxLength={50} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySign}>₱</Text>
            <TextInput style={styles.amountInput} value={target}
              onChangeText={t => setTarget(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Deadline <Text style={styles.optional}>(optional)</Text>
          </Text>
          <View style={styles.presetRow}>
            {DEADLINE_PRESETS.map(p => {
              const val = addDays(p.days);
              const isSelected = deadline === val;
              return (
                <Pressable key={p.label} onPress={() => { tap(); setDeadline(isSelected ? null : val); }}
                  style={[styles.presetBtn, isSelected && styles.presetBtnActive]}>
                  <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {deadline && (
            <View style={styles.deadlinePill}>
              <Ionicons name="calendar" size={14} color="#9B1C1C" />
              <Text style={styles.deadlinePillText}>Target: {formatDate(deadline)}</Text>
              <Pressable onPress={() => setDeadline(null)} style={{ marginLeft: 4 }}>
                <Ionicons name="close-circle" size={16} color="#9B1C1C" />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose an Icon</Text>
          <View style={styles.iconGrid}>
            {ICONS.map(icon => (
              <Pressable key={icon.name} onPress={() => { tap(); setSelectedIcon(icon.name); }}
                style={[styles.iconBtn, selectedIcon === icon.name && styles.iconBtnActive]}>
                <Ionicons name={icon.name as any} size={24}
                  color={selectedIcon === icon.name ? '#9B1C1C' : Colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable onPress={handleCreate} disabled={!isValid || isSubmitting}
          style={({ pressed }) => [styles.createBtn, !isValid && styles.createBtnDisabled, pressed && isValid && { opacity: 0.9 }]}>
          <Ionicons name="flag" size={20} color={Colors.white} />
          <Text style={styles.createBtnText}>{isSubmitting ? 'Creating...' : 'Create Goal'}</Text>
        </Pressable>
      </View>
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
  presetRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  presetBtn:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  presetBtnActive:  { backgroundColor: '#FFF7ED', borderColor: '#9B1C1C' },
  presetText:       { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: Colors.textSecondary },
  presetTextActive: { color: '#9B1C1C' },
  deadlinePill:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  deadlinePillText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#9B1C1C' },
  iconGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn:          { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  iconBtnActive:    { borderColor: '#9B1C1C', backgroundColor: '#FFF7ED' },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, backgroundColor: Colors.background },
  createBtn:        { backgroundColor: '#9B1C1C', borderRadius: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createBtnDisabled:{ opacity: 0.4 },
  createBtnText:    { fontSize: 17, fontFamily: 'DMSans_700Bold', color: Colors.white },
});
