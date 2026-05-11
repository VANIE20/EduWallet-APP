import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  SectionList, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '../constants/colors';

type EntryType = 'new' | 'fix' | 'improvement' | 'security';
interface Entry { type: EntryType; text: string; }
interface Release { version: string; date: string; label?: string; entries: Entry[]; }

const CHANGELOG: Release[] = [
  {
    version: '1.6.0',
    date: 'May 11, 2026',
    label: 'Latest',
    entries: [
      { type: 'new',         text: 'Walli AI Assistant — a built-in AI-powered help chatbot accessible from the Help Center, powered by Claude.' },
      { type: 'new',         text: 'Walli automatically saves support conversations as tickets in the database so issues are tracked and can be reviewed.' },
      { type: 'new',         text: 'Help Center screen redesigned with a dedicated chat interface for Walli, replacing the old static FAQ.' },
      { type: 'new',         text: 'Avatar upload — users can now set a profile photo from their photo library on the Profile screen.' },
      { type: 'new',         text: 'Avatar is stored in Supabase Storage and persists across sessions and app restarts.' },
      { type: 'improvement', text: 'Guardian and Student dashboards now show the profile avatar photo in the top-right corner instead of a letter initial.' },
      { type: 'improvement', text: 'Profile screen shows the avatar image with a camera button overlay; tapping it opens the photo picker.' },
      { type: 'fix',         text: 'Fixed "bucket not found" error on avatar upload — storage bucket and RLS policies corrected.' },
      { type: 'fix',         text: 'Fixed avatar not saving to database — RLS UPDATE policy now matches on auth_user_id instead of id.' },
      { type: 'fix',         text: 'Fixed avatar disappearing after reload — loadAvatar now correctly queries by auth_user_id.' },
      { type: 'fix',         text: 'Fixed deprecated ImagePicker.MediaTypeOptions — updated to use string array format.' },
    ],
  },
  {
    version: '1.5.0',
    date: 'May 10, 2026',
    entries: [
      { type: 'new',         text: 'Guardian can now remove a linked student — requires OTP email verification before the unlink is processed.' },
      { type: 'new',         text: 'After removing all students, guardian is prompted to cash out their wallet balance or invite a new student.' },
      { type: 'improvement', text: 'Linked Students card now shows for single students too, with a remove button next to each name.' },
      { type: 'improvement', text: 'Student goal deadline replaced with a manual date picker — set any exact date up to 20 years ahead, no more preset week/month buttons.' },
      { type: 'new',         text: 'Deadline countdown now shows "X days remaining" for near dates and "X months remaining" for far dates.' },
      { type: 'new',         text: 'Date picker enforces boundaries: past dates are blocked, maximum is 20 years from today.' },
      { type: 'improvement', text: 'Expense screen now unified — Cash Out removed as a separate tab; all payouts processed through E-Wallet directly from the Expense screen.' },
      { type: 'fix',         text: 'Fixed OTA update error in Expo Go: checkForUpdateAsync() now only runs in production builds.' },
      { type: 'improvement', text: 'Guardian dashboard redesigned with a maroon color theme (deep gradient, maroon accents, warm rose stat pills).' },
      { type: 'improvement', text: 'Student dashboard redesigned with a warm ember/burnt orange color theme replacing the previous dark palette.' },
      { type: 'improvement', text: 'Both dashboards now show up to 7 recent transactions instead of 5.' },
      { type: 'improvement', text: 'Transaction history screens now show a Daily Activity bar chart for the last 7 days.' },
      { type: 'fix',         text: 'Ad banner image now fills its container correctly — removed offset margin and stray border that caused it to appear crooked.' },
      { type: 'fix',         text: 'Balance and currency amounts now shrink to fit on one line instead of wrapping or pushing layout down.' },
      { type: 'fix',         text: 'Scroll content on both dashboards now ends at the last item with no excess blank space below.' },
      { type: 'improvement', text: 'Warning badges (low/no balance) now use an icon + text row for a cleaner look.' },
      { type: 'improvement', text: 'Ad banner repositioned to sit between content sections for a more natural flow.' },
    ],
  },
  {
    version: '1.4.0',
    date: 'May 8, 2026',
    entries: [
      { type: 'new',         text: 'Push notifications — get alerted when allowance is sent, money is spent, deposit succeeds, or spending limit is near.' },
      { type: 'new',         text: 'Firebase FCM V1 integrated for reliable Android push delivery.' },
      { type: 'fix',         text: 'Student balance no longer resets to old value after guardian sends allowance.' },
      { type: 'fix',         text: 'All wallet operations (expense, cashout, savings contribution, goal delete) now fetch fresh balance from DB instead of using stale cached value.' },
      { type: 'improvement', text: 'Push token saved to Supabase on login and removed on logout.' },
      { type: 'fix',         text: 'Fixed RLS policy blocking push token save to push_tokens table.' },
    ],
  },
  {
    version: '1.3.0',
    date: 'May 7, 2026',
    entries: [
      { type: 'new',         text: 'Guardian can now lock a student\'s savings goal to prevent early withdrawals.' },
      { type: 'new',         text: 'Guardian can send a Bonus directly into any of the student\'s savings goals.' },
      { type: 'new',         text: 'Transaction history now shows the correct student name per allowance (e.g. "Sent to Jhuvanie") — supports multiple students.' },
      { type: 'fix',         text: 'toUserId and fromUserId added to Transaction type so history correctly identifies recipients.' },
      { type: 'fix',         text: 'Bonus and lock actions now correctly update the goal in real time.' },
      { type: 'fix',         text: 'Removed deprecated notification flag that caused a warning on newer Expo versions.' },
    ],
  },
  {
    version: '1.2.0',
    date: 'April 28, 2026',
    entries: [
      { type: 'fix',         text: 'Fixed "not linked" status showing for already-linked accounts due to UUID mismatch between auth UUID and users table UUID.' },
      { type: 'fix',         text: 'Fixed link-required screen appearing again after sign out and re-login.' },
      { type: 'fix',         text: 'Invite acceptance now falls back to direct insert if RPC fails, and verifies the row was actually saved.' },
      { type: 'fix',         text: 'Removed duplicate isLinked useEffect that was racing with onAuthStateChange.' },
      { type: 'fix',         text: 'State now clears immediately on SIGNED_OUT to prevent stale isLinked carrying over to next login.' },
      { type: 'fix',         text: 'login.tsx and otp-verify.tsx now use correct dual-UUID lookup for link status check.' },
      { type: 'fix',         text: 'user_links insert no longer fails with "column status does not exist" error.' },
    ],
  },
  {
    version: '1.1.0',
    date: 'April 20, 2026',
    entries: [
      { type: 'new',         text: 'Forgot PIN screen — reset PIN via OTP email verification.' },
      { type: 'new',         text: 'Profile screen — edit name, email, phone, and PIN with OTP verification.' },
      { type: 'improvement', text: 'Guardian dashboard now shows all linked students with a quick-switch selector.' },
      { type: 'improvement', text: 'Email change now requires phone number on account for security.' },
      { type: 'fix',         text: 'setLoggedInUser(null) TypeScript error fixed — type now accepts null.' },
      { type: 'fix',         text: 'Sign out now uses logoutUser() from context instead of manual null calls.' },
      { type: 'fix',         text: 'OTP gate (needsOTP) was permanently disabled — now correctly calls setNeedsOTP after session check.' },
      { type: 'security',    text: 'PayMongo secret key moved from hardcoded string to environment variable.' },
    ],
  },
  {
    version: '1.0.1',
    date: 'April 10, 2026',
    entries: [
      { type: 'fix',         text: 'Goal Name input in student add-goal screen was bound to wrong state and had inline code comments rendering as visible text.' },
      { type: 'fix',         text: 'Guardian goals screen was navigating to /student/add-goal instead of /guardian/add-goal.' },
      { type: 'fix',         text: 'Removed unused Animated and FadeInDown imports from goals screens.' },
      { type: 'fix',         text: 'Fixed useRef type error in deposit screen.' },
      { type: 'fix',         text: 'React version mismatch (19.1.0 vs 19.2.5) causing APK crash — downgraded to match react-native renderer.' },
    ],
  },
  {
    version: '1.0.0',
    date: 'April 1, 2026',
    entries: [
      { type: 'new',         text: 'Initial release of EduWallet.' },
      { type: 'new',         text: 'Guardian wallet — deposit funds via PayMongo and send allowances instantly or on a schedule.' },
      { type: 'new',         text: 'Student wallet — receive allowances, log expenses by category.' },
      { type: 'new',         text: 'Spending limit — guardian sets a daily cap to help students budget.' },
      { type: 'new',         text: 'Savings goals — students set targets and track progress.' },
      { type: 'new',         text: 'Transaction history for both guardian and student.' },
      { type: 'new',         text: 'Guardian ↔ student linking via invite email.' },
      { type: 'new',         text: '6-digit PIN login with OTP email verification.' },
    ],
  },
];

const TYPE_CONFIG: Record<EntryType, { icon: string; color: string; bg: string; label: string }> = {
  new:         { icon: 'sparkles',        color: '#7C3AED', bg: '#F5F3FF', label: 'New' },
  fix:         { icon: 'build',           color: '#0369A1', bg: '#E0F2FE', label: 'Fix' },
  improvement: { icon: 'trending-up',     color: '#047857', bg: '#D1FAE5', label: 'Improved' },
  security:    { icon: 'shield-checkmark',color: '#B45309', bg: '#FEF3C7', label: 'Security' },
};

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

export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();
  const sections = CHANGELOG.map((release, idx) => ({
    release,
    isFirst: idx === 0,
    data: release.entries,
  }));

  return (
    <View style={styles.container}>
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
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 24 }]}
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

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontFamily: 'DMSans_600SemiBold', color: Colors.text },
  headerSpacer:       { width: 40 },
  list:               { paddingHorizontal: 20, paddingTop: 4 },
  sectionSeparator:   { height: 8 },
  releaseHeader:      { backgroundColor: Colors.background, paddingTop: 24, paddingBottom: 10 },
  releaseHeaderFirst: { paddingTop: 4 },
  versionRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  versionText:        { fontSize: 20, fontFamily: 'DMSans_700Bold', color: Colors.text },
  latestBadge:        { backgroundColor: '#800000', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  latestBadgeText:    { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#fff', letterSpacing: 0.5 },
  dateText:           { fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.textTertiary },
  entryCard:          { backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  entryRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  entryBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 1, flexShrink: 0 },
  entryBadgeText:     { fontSize: 11, fontFamily: 'DMSans_700Bold' },
  entryText:          { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', color: Colors.text, lineHeight: 20 },
});