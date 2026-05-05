import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '../../constants/colors';
import { useApp } from '../../lib/AppContext';

const ICONS = [
  { name: 'headset', label: 'Headphones' },
  { name: 'phone-portrait', label: 'Phone' },
  { name: 'laptop', label: 'Laptop' },
  { name: 'bicycle', label: 'Bike' },
  { name: 'game-controller', label: 'Games' },
  { name: 'book', label: 'Books' },
  { name: 'shirt', label: 'Clothes' },
  { name: 'gift', label: 'Gift' },
  { name: 'airplane', label: 'Travel' },
  { name: 'musical-notes', label: 'Music' },
  { name: 'camera', label: 'Camera' },
  { name: 'flag', label: 'Other' },
];

export default function AddGoalScreen() {
  const insets = useSafeAreaInsets();
  const { addSavingsGoal } = useApp();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('flag');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedTarget = parseFloat(target) || 0;
  const isValid = name.trim().length > 0 && parsedTarget > 0;

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCreate = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addSavingsGoal(name.trim(), parsedTarget, selectedIcon);
    setIsSubmitting(false);
    router.back();
  };

  return (
    <View style={[styles.container]}>
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
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Goal Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g., New Headphones"
            placeholderTextColor={Colors.textTertiary}
            maxLength={50}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySign}>₱</Text>
            <TextInput
              style={styles.amountInput}
              value={target}
              onChangeText={(t) => setTarget(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose an Icon</Text>
          <View style={styles.iconGrid}>
            {ICONS.map((icon) => (
              <Pressable
                key={icon.name}
                onPress={() => { tap(); setSelectedIcon(icon.name); }}
                style={[
                  styles.iconBtn,
                  selectedIcon === icon.name && styles.iconBtnActive,
                ]}
              >
                <Ionicons
                  name={icon.name as any}
                  size={24}
                  color={selectedIcon === icon.name ? '#6366F1' : Colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 }]}>
        <Pressable
          onPress={handleCreate}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            styles.createBtn,
            !isValid && styles.createBtnDisabled,
            pressed && isValid && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="flag" size={20} color={Colors.white} />
          <Text style={styles.createBtnText}>
            {isSubmitting ? 'Creating...' : 'Create Goal'}
          </Text>
        </Pressable>
      </View>
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
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: Colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencySign: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: Colors.textTertiary,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  iconBtnActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
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
  createBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: Colors.white,
  },
});
