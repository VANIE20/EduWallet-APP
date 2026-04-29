/**
 * PinLock.tsx
 *
 * A 4-digit PIN gate for sensitive screens (send money, change spending limits, etc.)
 * Usage:
 *   <PinLock mode="setup" onSuccess={() => …} />   // first-time setup
 *   <PinLock mode="verify" onSuccess={() => …} />  // gate an action
 *
 * PIN is stored in AsyncStorage under the key 'app_pin'.
 * For production you'd want expo-secure-store instead.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../constants/colors';

const PIN_STORAGE_KEY = 'app_pin';
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

type Mode = 'setup' | 'verify';

interface PinLockProps {
  visible: boolean;
  mode: Mode;
  accentColor?: string;
  onSuccess: () => void;
  onDismiss?: () => void;
}

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

export async function hasPinSet(): Promise<boolean> {
  try {
    const pin = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    return pin !== null && pin.length === PIN_LENGTH;
  } catch {
    return false;
  }
}

export async function savePin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_STORAGE_KEY, pin);
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    return stored === pin;
  } catch {
    return false;
  }
}

export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_STORAGE_KEY);
}

export default function PinLock({
  visible,
  mode,
  accentColor = Colors.guardianGradientStart,
  onSuccess,
  onDismiss,
}: PinLockProps) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setError('');
    }
  }, [visible]);

  // Lockout countdown
  useEffect(() => {
    if (locked && lockTimer > 0) {
      timerRef.current = setInterval(() => {
        setLockTimer(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setLocked(false);
            setAttempts(0);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [locked]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const animateDot = (index: number) => {
    Animated.sequence([
      Animated.timing(dotAnims[index], { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.spring(dotAnims[index], { toValue: 0.85, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key: string) => {
    if (locked) return;

    const current = step === 'confirm' ? confirmPin : pin;

    if (key === 'del') {
      const next = current.slice(0, -1);
      step === 'confirm' ? setConfirmPin(next) : setPin(next);
      setError('');
      return;
    }

    if (!key || current.length >= PIN_LENGTH) return;

    const next = current + key;
    step === 'confirm' ? setConfirmPin(next) : setPin(next);
    animateDot(next.length - 1);

    if (next.length === PIN_LENGTH) {
      // Small delay so last dot animates
      setTimeout(() => handleComplete(next), 150);
    }
  };

  const handleComplete = async (entered: string) => {
    if (mode === 'setup') {
      if (step === 'enter') {
        setStep('confirm');
        setConfirmPin('');
        setError('');
      } else {
        // Confirm step
        if (entered === pin) {
          await savePin(pin);
          onSuccess();
        } else {
          setError('PINs do not match. Try again.');
          shake();
          setConfirmPin('');
        }
      }
    } else {
      // Verify mode
      const ok = await verifyPin(entered);
      if (ok) {
        setAttempts(0);
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        shake();
        setPin('');
        if (newAttempts >= MAX_ATTEMPTS) {
          setLocked(true);
          setLockTimer(30);
          setError('Too many attempts. Locked for 30 seconds.');
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} left.`);
        }
      }
    }
  };

  const currentPin = step === 'confirm' ? confirmPin : pin;

  const title =
    mode === 'setup'
      ? step === 'enter' ? 'Create your PIN' : 'Confirm your PIN'
      : 'Enter your PIN';

  const subtitle =
    mode === 'setup'
      ? step === 'enter'
        ? 'Set a 4-digit PIN to protect sensitive actions'
        : 'Re-enter the same PIN to confirm'
      : 'This action requires your PIN';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.overlay, { paddingTop: Platform.OS === 'web' ? 40 : insets.top }]}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name="lock-closed" size={28} color={accentColor} />
            </View>
            {onDismiss && (
              <Pressable style={styles.closeBtn} onPress={onDismiss}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* PIN dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const filled = i < currentPin.length;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    filled && { backgroundColor: accentColor, transform: [{ scale: dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }] },
                    !filled && styles.dotEmpty,
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Error */}
          {error ? (
            <Text style={styles.error}>{locked ? `🔒 ${error}` : error}</Text>
          ) : (
            <Text style={styles.errorPlaceholder}> </Text>
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            {KEYPAD.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((key, ki) => {
                  if (!key) return <View key={ki} style={styles.keyPlaceholder} />;
                  return (
                    <Pressable
                      key={ki}
                      style={({ pressed }) => [
                        styles.key,
                        pressed && styles.keyPressed,
                        locked && styles.keyDisabled,
                      ]}
                      onPress={() => handleKey(key)}
                      disabled={locked}
                    >
                      {key === 'del' ? (
                        <Ionicons name="backspace-outline" size={22} color={locked ? Colors.textTertiary : Colors.text} />
                      ) : (
                        <Text style={[styles.keyText, locked && { color: Colors.textTertiary }]}>{key}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Lock countdown */}
          {locked && (
            <Text style={styles.lockCountdown}>Try again in {lockTimer}s</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  error: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 18,
  },
  errorPlaceholder: {
    minHeight: 18,
    marginBottom: 20,
  },
  keypad: {
    width: '100%',
    gap: 8,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    backgroundColor: Colors.border,
    transform: [{ scale: 0.94 }],
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPlaceholder: {
    width: 76,
    height: 76,
  },
  keyText: {
    fontSize: 24,
    fontFamily: 'DMSans_600SemiBold',
    color: Colors.text,
  },
  lockCountdown: {
    marginTop: 16,
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#EF4444',
  },
});
