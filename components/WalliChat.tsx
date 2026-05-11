/**
 * WalliChat.tsx
 * Drop-in AI chat component for EduWallet Help Center.
 * Calls the `walli-chat` Supabase Edge Function — API key stays on the server.
 * Reads loggedInUser from AppContext to pre-fill support tickets.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/AppContext';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'walli' | 'user';
  text: string;
  chips?: string[];
  isTicketForm?: boolean;
}

type APIMessage = { role: 'user' | 'assistant'; content: string };

// ─── Config ──────────────────────────────────────────────────────────────────

// ✅ Calls your Edge Function — API key is stored securely as a Supabase secret
const WALLI_FUNCTION_URL = 'https://hfglwbcxtaskzarlpllk.supabase.co/functions/v1/walli-chat';

const WELCOME_CHIPS = [
  'How do I send allowance?',
  'How to set a spending limit?',
  'How to create a savings goal?',
  'I have an account problem',
];

function uid() { return Math.random().toString(36).slice(2, 10); }

import { registerWalliLogoutCallback } from '../lib/AppContext';

// ─── Persistent chat state (survives navigation, cleared on logout) ───────────
let _persistedMessages: ChatMessage[] = [];
let _persistedHistory: APIMessage[] = [];

function clearWalliChat() {
  _persistedMessages = [];
  _persistedHistory = [];
}

// Register with AppContext so logout clears chat without circular import
registerWalliLogoutCallback(clearWalliChat);

// ─── Ticket Form ──────────────────────────────────────────────────────────────

function TicketForm({
  prefillName,
  prefillEmail,
  prefillIssue,
  onSuccess,
}: {
  prefillName: string;
  prefillEmail: string;
  prefillIssue: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [issue, setIssue] = useState(prefillIssue);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !issue.trim()) {
      Alert.alert('Incomplete', 'Please fill in all fields before submitting.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        user_name: name.trim(),
        user_email: email.trim(),
        message: issue.trim(),
        category: 'general',
        status: 'open',
      });
      if (error) throw error;
      setDone(true);
      onSuccess();
    } catch {
      Alert.alert('Error', 'Could not submit your ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={tf.success}>
        <Text style={tf.successIcon}>✅</Text>
        <Text style={tf.successText}>
          Ticket submitted! Our team will reply to{' '}
          <Text style={tf.bold}>{email}</Text> within 24 hours. Salamat! 🤖
        </Text>
      </View>
    );
  }

  return (
    <View style={tf.card}>
      <Text style={tf.label}>Submit a Support Ticket</Text>
      <TextInput
        style={tf.input}
        placeholder="Your name"
        placeholderTextColor="#AAA"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={tf.input}
        placeholder="Email address"
        placeholderTextColor="#AAA"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={[tf.input, tf.textarea]}
        placeholder="Describe your issue..."
        placeholderTextColor="#AAA"
        value={issue}
        onChangeText={setIssue}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
      <Pressable style={[tf.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={tf.btnText}>Send Ticket →</Text>}
      </Pressable>
    </View>
  );
}

const tf = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E0E0E0', padding: 14, gap: 8,
  },
  label: {
    fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#777',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#1a1a1a',
    backgroundColor: '#FAFAFA',
  },
  textarea: { height: 80, paddingTop: 10 },
  btn: {
    backgroundColor: '#6B0F1A', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', marginTop: 2,
  },
  btnText: { color: '#fff', fontSize: 14, fontFamily: 'DMSans_700Bold' },
  success: {
    backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#86EFAC',
    borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  successIcon: { fontSize: 18 },
  successText: { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#166534', lineHeight: 18 },
  bold: { fontFamily: 'DMSans_700Bold' },
});

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({
  msg, onChipPress, onTicketSuccess, prefillName, prefillEmail,
}: {
  msg: ChatMessage;
  onChipPress: (t: string) => void;
  onTicketSuccess: () => void;
  prefillName: string;
  prefillEmail: string;
}) {
  const isUser = msg.role === 'user';

  const avatarEl = (
    <View style={b.avatar}>
      <Image source={require('../assets/icon.png')} style={b.avatarImg} />
    </View>
  );

  if (msg.isTicketForm) {
    return (
      <View style={b.walliRow}>
        {avatarEl}
        <View style={{ flex: 1 }}>
          <TicketForm
            prefillName={prefillName}
            prefillEmail={prefillEmail}
            prefillIssue={msg.text}
            onSuccess={onTicketSuccess}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[b.row, isUser && b.rowUser]}>
      {!isUser && avatarEl}
      <View style={{ maxWidth: '80%' }}>
        <View style={[b.bubble, isUser ? b.bubbleUser : b.bubbleWalli]}>
          <Text style={[b.text, isUser && b.textUser]}>{msg.text}</Text>
        </View>
        {!!msg.chips?.length && (
          <View style={b.chips}>
            {msg.chips.map((c) => (
              <Pressable key={c} style={b.chip} onPress={() => onChipPress(c)}>
                <Text style={b.chipText}>{c}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
  rowUser: { flexDirection: 'row-reverse' },
  walliRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FED7AA', flexShrink: 0 },
  avatarImg: { width: 28, height: 28 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleWalli: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E8E8', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#6B0F1A', borderBottomRightRadius: 4 },
  text: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#1a1a1a', lineHeight: 20 },
  textUser: { color: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 2 },
  chip: { backgroundColor: '#FFF8F2', borderWidth: 1, borderColor: '#FCD9B0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#6B0F1A' },
});

// ─── Typing Dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <View style={[b.row, { marginBottom: 2 }]}>
      <View style={b.avatar}>
        <Image source={require('../assets/icon.png')} style={b.avatarImg} />
      </View>
      <View style={[b.bubble, b.bubbleWalli, { paddingVertical: 14 }]}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => <View key={i} style={dot.d} />)}
        </View>
      </View>
    </View>
  );
}
const dot = StyleSheet.create({ d: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#BBBBBB' } });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WalliChat() {
  const { loggedInUser } = useApp();
  const insets = useSafeAreaInsets();
  const prefillName = loggedInUser?.displayName ?? '';
  const prefillEmail = loggedInUser?.email ?? '';

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    _persistedMessages.length > 0 ? _persistedMessages : [{
      id: uid(),
      role: 'walli',
      text: `Kumusta! I'm Walli 🤖, your EduWallet assistant.\nI can help with allowances, savings goals, spending limits, cash out, and more!`,
      chips: WELCOME_CHIPS,
    }]
  );
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const history = useRef<APIMessage[]>(_persistedHistory);

  // Sync messages to persisted store
  const setMessagesPersisted = useCallback((updater: (p: ChatMessage[]) => ChatMessage[]) => {
    setMessages((p) => {
      const next = updater(p);
      _persistedMessages = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (_persistedMessages.length === 0) {
      _persistedMessages = messages;
    }
  }, []);

  const scrollDown = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);



  const push = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessagesPersisted((p) => [...p, { ...msg, id: uid() }]);
    scrollDown();
  }, [scrollDown, setMessagesPersisted]);

  const handleSend = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    setMessagesPersisted((p) => p.map((m) => m.chips?.length ? { ...m, chips: [] } : m));
    push({ role: 'user', text });
    history.current.push({ role: 'user', content: text });
    _persistedHistory = history.current;
    setThinking(true);
    scrollDown();

    try {
      // ✅ Secure: API key never leaves the server
      const res = await fetch(WALLI_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.current }),
      });

      const data = await res.json();
      const reply = (data.content ?? []).map((c: any) => c.text ?? '').join('').trim();
      setThinking(false);

      if (reply.startsWith('{"action":"show_ticket_form"')) {
        try {
          const parsed = JSON.parse(reply);
          const intro = "I'll help you submit a support ticket. Please fill out this form:";
          history.current.push({ role: 'assistant', content: intro });
          push({ role: 'walli', text: intro });
          push({ role: 'walli', text: parsed.summary ?? '', isTicketForm: true });
          return;
        } catch { /* fall through */ }
      }

      history.current.push({ role: 'assistant', content: reply });
      _persistedHistory = history.current;
      push({ role: 'walli', text: reply });
    } catch {
      setThinking(false);
      push({ role: 'walli', text: 'Sorry, may problema sa koneksyon. Please try again. 🤖' });
    }
  }, [input, thinking, push, scrollDown, setMessagesPersisted]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <Bubble
            key={m.id}
            msg={m}
            onChipPress={(c) => handleSend(c)}
            onTicketSuccess={() => push({ role: 'walli', text: 'Ticket submitted! Our team will reach out by email. Salamat! 🤖' })}
            prefillName={prefillName}
            prefillEmail={prefillEmail}
          />
        ))}
        {thinking && <TypingDots />}
      </ScrollView>

      <View style={[s.bar, { paddingBottom: 10 + insets.bottom }]}>
        <TextInput
          style={s.input}
          placeholder="Ask Walli anything..."
          placeholderTextColor="#BBB"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => handleSend()}
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || thinking) && s.sendBtnOff]}
          onPress={() => handleSend()}
          disabled={!input.trim() || thinking}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  messages: { flex: 1, backgroundColor: '#FFF8F2' },
  messagesContent: { padding: 14, gap: 10, paddingBottom: 6 },
  bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EBEBEB',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#1a1a1a',
    maxHeight: 100, backgroundColor: '#FAFAFA',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#6B0F1A', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnOff: { opacity: 0.35 },
});