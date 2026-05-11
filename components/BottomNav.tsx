import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import Colors from '../constants/colors';

interface BottomNavProps {
  userType: 'guardian' | 'student';
  onLogout: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
}

// Help removed — now lives in the header as a ? icon
const guardianItems: NavItem[] = [
  { key: 'home',     label: 'Home',     icon: 'home-outline',     activeIcon: 'home',     route: '/guardian' },
  { key: 'history',  label: 'History',  icon: 'receipt-outline',  activeIcon: 'receipt',  route: '/guardian/history' },
  { key: 'schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar', route: '/guardian/schedule' },
  { key: 'limit',    label: 'Limits',   icon: 'shield-outline',   activeIcon: 'shield',   route: '/guardian/spending-limit' },
  { key: 'goals',    label: 'Goals',    icon: 'flag-outline',     activeIcon: 'flag',     route: '/guardian/goals' },
];

const studentItems: NavItem[] = [
  { key: 'home',    label: 'Home',    icon: 'home-outline',          activeIcon: 'home',          route: '/student' },
  { key: 'expense', label: 'Expense', icon: 'remove-circle-outline', activeIcon: 'remove-circle', route: '/student/expense' },
  { key: 'goals',   label: 'Goals',   icon: 'flag-outline',          activeIcon: 'flag',          route: '/student/goals' },
  { key: 'history', label: 'History', icon: 'receipt-outline',       activeIcon: 'receipt',       route: '/student/history' },
];

function NavTab({
  item,
  isActive,
  accentColor,
  onPress,
}: {
  item: NavItem;
  isActive: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable style={styles.tab} onPress={handlePress}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale: scaleAnim }] }]}>
        {isActive && (
          <View style={[styles.activePill, { backgroundColor: accentColor + '18' }]} />
        )}
        <Ionicons
          name={(isActive ? item.activeIcon : item.icon) as any}
          size={22}
          color={isActive ? accentColor : Colors.textTertiary}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isActive ? accentColor : Colors.textTertiary },
            isActive && styles.tabLabelActive,
          ]}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function BottomNav({ userType, onLogout }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isGuardian = userType === 'guardian';
  const accentColor = isGuardian ? Colors.guardianGradientStart : Colors.studentPrimary;
  const items = isGuardian ? guardianItems : studentItems;

  const activeKey = items.find((item) => {
    if (item.key === 'home') return pathname === item.route;
    return pathname.startsWith(item.route);
  })?.key ?? 'home';

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8) },
      ]}
    >
      <View style={styles.topBorder} />
      <View style={styles.row}>
        {items.map((item) => (
          <NavTab
            key={item.key}
            item={item}
            isActive={activeKey === item.key}
            accentColor={accentColor}
            onPress={() => {
              if (item.key === 'home') {
                router.replace(item.route as any);
              } else {
                router.push(item.route as any);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  topBorder: { height: 1, backgroundColor: Colors.border, opacity: 0.6 },
  row: { flexDirection: 'row', paddingTop: 6, paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabInner: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 14, position: 'relative', minWidth: 48,
  },
  activePill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14 },
  tabLabel: { fontSize: 10, fontFamily: 'DMSans_500Medium', marginTop: 3 },
  tabLabelActive: { fontFamily: 'DMSans_700Bold' },
});