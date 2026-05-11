import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '../lib/AppContext';
import WalliChat from '../components/WalliChat';
import Colors from '../constants/colors';

const MAROON_DARK = '#3D0000';
const MAROON = '#6B0F1A';


export default function HelpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: Platform.OS === 'web' ? 20 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >

      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Image source={require('../assets/icon.png')} style={styles.headerIcon} />
          <View>
            <Text style={styles.headerTitle}>Help Center</Text>
            <Text style={styles.headerSub}>Powered by Wallibayola 🤖</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Notice Banner ──────────────────────── */}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>🤖 EduWallet Help Center with AI Assistant</Text>
        <Text style={styles.noticeSubtitle}>Cant repair broken heart. ahla wabalo</Text>
        <View style={styles.steps}>

        </View>
      </View>

      {/* ── Chat ───────────────────────────────── */}
      <View style={styles.chatShell}>
        <WalliChat />
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MAROON_DARK,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  headerIcon: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitle: {
    fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#fff',
  },
  headerSub: {
    fontSize: 11, fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.6)', marginTop: 1,
  },

  // Notice banner
  notice: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAD8C8',
    padding: 14,
  },
  noticeTitle: {
    fontSize: 13.5, fontFamily: 'DMSans_700Bold',
    color: MAROON_DARK, marginBottom: 8,
  },
  noticeSubtitle: {
    fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#888',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  steps: { gap: 7 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: MAROON, alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#fff' },
  stepText: {
    flex: 1, fontSize: 12.5, fontFamily: 'DMSans_400Regular',
    color: '#333', lineHeight: 18,
  },
  stepStrong: { fontFamily: 'DMSans_700Bold', color: MAROON },
  stepDetail: { color: '#555' },

  // Chat shell
  chatShell: {
    flex: 1,
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAD8C8',
    backgroundColor: '#FFF8F2',
  },
});