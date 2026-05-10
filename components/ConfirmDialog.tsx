/**
 * ConfirmDialog — a clean, professional dialog that replaces Alert.alert.
 *
 * Usage:
 *   const [dialog, setDialog] = useState<DialogConfig | null>(null);
 *
 *   // Show a dialog:
 *   setDialog({
 *     type: 'confirm',       // 'success' | 'confirm' | 'error' | 'info'
 *     title: 'Confirm',
 *     message: 'Are you sure?',
 *     confirmLabel: 'Yes',
 *     onConfirm: () => doSomething(),
 *   });
 *
 *   // In JSX:
 *   <ConfirmDialog config={dialog} onClose={() => setDialog(null)} />
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type DialogType = 'success' | 'confirm' | 'error' | 'info';

export interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;   // default: 'OK'
  cancelLabel?: string;    // if provided, shows a cancel button
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface Props {
  config: DialogConfig | null;
  onClose: () => void;
}

const TYPE_CONFIG: Record<DialogType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}> = {
  success: { icon: 'checkmark-circle', color: '#16A34A', bg: '#DCFCE7' },
  confirm: { icon: 'help-circle',      color: '#2563EB', bg: '#DBEAFE' },
  error:   { icon: 'close-circle',     color: '#DC2626', bg: '#FEE2E2' },
  info:    { icon: 'information-circle', color: '#0284C7', bg: '#E0F2FE' },
};

export default function ConfirmDialog({ config, onClose }: Props) {
  const scale   = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (config) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 180 }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [config]);

  if (!config) return null;

  const cfg = TYPE_CONFIG[config.type];

  const handleConfirm = () => {
    onClose();
    config.onConfirm?.();
  };

  const handleCancel = () => {
    onClose();
    config.onCancel?.();
  };

  return (
    <Modal visible={!!config} transparent animationType="none" onRequestClose={handleCancel}>
      <View style={s.overlay}>
        <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>

          {/* Icon */}
          <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={38} color={cfg.color} />
          </View>

          {/* Text */}
          <Text style={s.title}>{config.title}</Text>
          <Text style={s.message}>{config.message}</Text>

          {/* Buttons */}
          <View style={[s.btnRow, !config.cancelLabel && s.btnRowSingle]}>
            {config.cancelLabel && (
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [s.btn, s.btnCancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={s.btnCancelText}>{config.cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                s.btn,
                s.btnConfirm,
                { backgroundColor: cfg.color },
                pressed && { opacity: 0.85 },
                !config.cancelLabel && s.btnFull,
              ]}
            >
              <Text style={s.btnConfirmText}>{config.confirmLabel ?? 'OK'}</Text>
            </Pressable>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 },
  iconWrap:     { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title:        { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  message:      { fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btnRow:       { flexDirection: 'row', gap: 10, width: '100%' },
  btnRowSingle: { justifyContent: 'center' },
  btn:          { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnFull:      { flex: 1 },
  btnCancel:    { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  btnCancelText:  { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: '#64748B' },
  btnConfirm:     { },
  btnConfirmText: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#fff' },
});