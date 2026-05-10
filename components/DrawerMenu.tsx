import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 300);

interface DrawerMenuItem {
  key: string;
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  onPress: () => void;
}

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  userType: 'guardian' | 'student';
  displayName: string;
  email: string;
  isLinked: boolean;
  onLogout: () => void;
}

export default function DrawerMenu({
  visible,
  onClose,
  userType,
  displayName,
  email,
  isLinked,
  onLogout,
}: DrawerMenuProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const isGuardian = userType === 'guardian';
  const accentColor = isGuardian ? Colors.guardianGradientStart : Colors.studentPrimary;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const guardianItems: DrawerMenuItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'home',
      iconBg: '#E0E7FF',
      iconColor: Colors.primary,
      onPress: () => { onClose(); router.replace('/guardian'); },
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: 'person-circle-outline',
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      onPress: () => { onClose(); router.push('/profile'); },
    },
    {
      key: 'goals',
      label: 'Savings Goals',
      icon: 'flag-outline',
      iconBg: '#ECFDF5',
      iconColor: '#10B981',
      onPress: () => { onClose(); router.push('/guardian/goals'); },
    },
    {
      key: 'invite',
      label: 'Link Student',
      icon: 'person-add-outline',
      iconBg: '#DCFCE7',
      iconColor: '#16A34A',
      onPress: () => { onClose(); router.push('/guardian/invite-student'); },
    },
    {
      key: 'history',
      label: 'Transaction History',
      icon: 'receipt-outline',
      iconBg: '#F5F3FF',
      iconColor: '#8B5CF6',
      onPress: () => { onClose(); router.push('/guardian/history'); },
    },
    {
      key: 'schedule',
      label: 'Schedule Allowance',
      icon: 'calendar-outline',
      iconBg: '#FFFBEB',
      iconColor: Colors.primary,
      onPress: () => { onClose(); router.push('/guardian/schedule'); },
    },
    {
      key: 'limit',
      label: 'Spending Limits',
      icon: 'shield-outline',
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      onPress: () => { onClose(); router.push('/guardian/spending-limit'); },
    },
  ];

  const studentItems: DrawerMenuItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'home',
      iconBg: '#FFFBEB',
      iconColor: Colors.studentPrimary,
      onPress: () => { onClose(); router.replace('/student'); },
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: 'person-circle-outline',
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      onPress: () => { onClose(); router.push('/profile'); },
    },
    {
      key: 'expense',
      label: 'Log Expense',
      icon: 'remove-circle-outline',
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      onPress: () => { onClose(); router.push('/student/expense'); },
    },
    {
      key: 'goals',
      label: 'Savings Goals',
      icon: 'flag-outline',
      iconBg: '#ECFDF5',
      iconColor: '#10B981',
      onPress: () => { onClose(); router.push('/student/goals'); },
    },
    {
      key: 'history',
      label: 'Transaction History',
      icon: 'receipt-outline',
      iconBg: '#F5F3FF',
      iconColor: '#8B5CF6',
      onPress: () => { onClose(); router.push('/student/history'); },
    },
  ];

  const items = isGuardian ? guardianItems : studentItems;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: slideAnim }],
            paddingTop: Platform.OS === 'web' ? 24 : insets.top,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>

        {/* User info header */}
        <View style={[styles.userHeader, { backgroundColor: accentColor + '15' }]}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Text style={styles.avatarText}>{(displayName || 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.roleText}>{isGuardian ? 'Guardian' : 'Student'}</Text>
            </View>
          </View>
        </View>

        {/* Nav items */}
        <View style={styles.navList}>
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
              onPress={item.onPress}
            >
              <View style={[styles.navIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>
              <Text style={styles.navLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <View style={styles.footer}>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.navItem, styles.logoutItem, pressed && styles.navItemPressed]}
            onPress={onLogout}
          >
            <View style={[styles.navIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.navLabel, { color: '#EF4444' }]}>Sign Out</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: Colors.text,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  roleText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  navList: {
    paddingHorizontal: 12,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 2,
    gap: 12,
  },
  navItemPressed: {
    backgroundColor: Colors.backgroundSecondary,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: Colors.text,
  },
  footer: {
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  logoutItem: {
    marginBottom: 0,
  },
});