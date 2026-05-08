import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  SectionList, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '../constants/colors';

// ─────────────────────────────────────────────────────────────
//  CHANGELOG DATA
//  To add a new update: prepend a new object to CHANGELOG.
//  type options: 'new' | 'fix' | 'improvement' | 'security'
// ─────────────────────────────────────────────────────────────
type EntryType = 'new' | 'fix' | 'improvement' | 'security';

interface Entry {
  type: EntryType;
  text: string;
}

interface Release {
  version: string;
  date: string;       // e.g. "May 8, 2025"
  label?: string;     // optional highlight label e.g. "Latest"
  entries: Entry[];
}

const CHANGELOG: Release[] = [
  {
    version: '1.2.0',
    date: 'May 8, 2026',
    label: 'Latest',
    entries: [
      { type: 'new',         text: 'Guardian can now lock a student\'s savings goal to prevent early withdrawals.' },
      { type: 'new',         text: 'Guardian can send a Bonus directly into any of the student\'s savings goals.' },
      { type: 'fix',         text: 'Bonus and lock actions now correctly update the goal in real time.' },
      { type: 'fix',         text: 'Removed deprecated notification flag that caused a warning on newer Expo versions.' },
    ],
  },
  {
    version: '1.1.0',
    date: 'April 20, 2026',
    entries: [
      { type: 'new',         text: 'Push notifications — get alerted when allowance is sent, money is spent, or a goal bonus arrives.' },
      { type: 'new',         text: 'Savings Goals for students — set a target, track progress, and redeem when complete.' },
      { type: 'improvement', text: 'Guardian dashboard now shows all linked students with a quick-switch selector.' },
      { type: 'fix',         text: 'Student balance no longer resets after a guardian deposit.' },
    ],
  },
  {
    version: '1.0.0',
    date: 'April 1, 2026',
    entries: [
      { type: 'new',         text: 'Initial release of EduWallet.' },
      { type: 'new',         text: 'Guardian wallet — deposit funds and send allowances instantly or on a schedule.' },
      { type: 'new',         text: 'Student wallet — receive allowances, log expenses by category.' },
      { type: 'new',         text: 'Spending limit — guardian sets a daily cap to help students budget.' },
      { type: 'new',         text: 'Transaction history for both guardian and student.' },
      { type: 'new',         text: 'Guardian ↔ student linking via invite code.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<EntryType, { icon: string; color: string; bg: string; label: string }> = {
  new:         { icon: 'sparkles',        color: '#7C3AED', bg: '#F5F3FF', label: 'New' },
  fix:         { icon: 'build',           color: '#0369A1', bg: '#E0F2FE', label: 'Fix' },
  improvement: { icon: 'trending-up',     color: '#047857', bg: '#D1FAE5', label: 'Improved' },
  security:    { icon: 'shield-checkmark',color: '#B45309', bg: '#FEF3C7', label: 'Security' },
};

// ─────────────────────────────────────────────────────────────
//  Components
// ─────────────────────────────────────────────────────────────
function EntryRow({ entry }: { entry: Entry }) {
  const cfg = TYPE_CONFIG[entry.type];
  return (
    <View style={styles.entryRow}>
      <View style={[styles.entryBadge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
        <Text style={[styles.entryBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <Text style={styles.entryText}>{entry.text}</Text>
    </View>
  );
}

function ReleaseHeader({ release, isFirst }: { release: Release; isFirst: boolean }) {
  return (
    <View style={[styles.releaseHeader, isFirst && styles.releaseHeaderFirst]}>
      <View style={styles.versionRow}>
        <Text style={styles.versionText}>v{release.version}</Text>
        {release.label && (
          <View style={styles.latestBadge}>
            <Text style={styles.latestBadgeText}>{release.label}</Text>
          </View>
        )}
      </View>
      <Text style={styles.dateText}>{release.date}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Screen
// ─────────────────────────────────────────────────────────────
export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();

  // Convert CHANGELOG into SectionList format
  const sections = CHANGELOG.map((release, idx) => ({
    release,
    isFirst: idx === 0,
    data: release.entries,
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>What's New</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.text + index}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <ReleaseHeader release={section.release} isFirst={section.isFirst} />
        )}
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <EntryRow entry={item} />
          </View>
        )}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  headerSpacer:       { width: 40 },

  // List
  list:               { paddingHorizontal: 20, paddingTop: 4 },
  sectionSeparator:   { height: 8 },

  // Release header
  releaseHeader:      { backgroundColor: Colors.background, paddingTop: 24, paddingBottom: 10 },
  releaseHeaderFirst: { paddingTop: 4 },
  versionRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  versionText:        { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text },
  latestBadge:        { backgroundColor: '#9B1C1C', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  latestBadgeText:    { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#fff', letterSpacing: 0.5 },
  dateText:           { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },

  // Entry card
  entryCard:          {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  entryRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  entryBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 1, flexShrink: 0 },
  entryBadgeText:     { fontSize: 11, fontFamily: 'DMSans_700Bold' },
  entryText:          { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.text, lineHeight: 20 },
});