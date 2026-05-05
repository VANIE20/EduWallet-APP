// components/OnboardingTutorial.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────────────────────
interface SlideSection {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}

interface Slide {
  id: string;
  type: 'welcome' | 'dashboard' | 'feature' | 'warning';
  gradientStart: string;
  gradientEnd: string;
  heading: string;
  subheading?: string;
  sections?: SlideSection[];
  warningText?: string;
}

// ── Slide Definitions ─────────────────────────────────────────────────────────
const GUARDIAN_SLIDES: Slide[] = [
  {
    id: 'welcome-guardian',
    type: 'welcome',
    gradientStart: '#7C3AED',
    gradientEnd: '#4F46E5',
    heading: 'Welcome, Guardian! 👋',
    subheading:
      'This quick guide will show you how to manage your student\'s allowance, set limits, and track their spending. Swipe to learn more!',
  },
  {
    id: 'testing-notice',
    type: 'warning',
    gradientStart: '#D97706',
    gradientEnd: '#B45309',
    heading: '⚠️ Testing Mode',
    subheading: 'Important notice before you begin',
    warningText:
      'This app is currently for TESTING purposes only. No real money is involved. All transactions, balances, and features are simulated. Please do not use real financial information.',
  },
  {
    id: 'guardian-dashboard',
    type: 'dashboard',
    gradientStart: '#7C3AED',
    gradientEnd: '#4F46E5',
    heading: 'Your Dashboard',
    subheading: 'Your command center for managing student finances',
    sections: [
      {
        icon: 'wallet',
        iconColor: '#7C3AED',
        iconBg: '#EDE9FE',
        title: 'Guardian Wallet',
        description: 'View your total balance. This is the source of all allowance funds you send to your students.',
      },
      {
        icon: 'school-outline',
        iconColor: '#0284C7',
        iconBg: '#E0F2FE',
        title: 'Student Balance',
        description: "See your linked student's current balance at a glance, right on the main card.",
      },
      {
        icon: 'time',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        title: 'Recent Activity',
        description: 'Your last 5 transactions (deposits & allowances sent) appear here for quick reference.',
      },
    ],
  },
  {
    id: 'deposit',
    type: 'feature',
    gradientStart: '#16A34A',
    gradientEnd: '#065F46',
    heading: 'Deposit',
    subheading: 'Add funds to your guardian wallet',
    sections: [
      {
        icon: 'add-circle',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        title: 'How it works',
        description: 'Tap "Deposit" on the dashboard to add a simulated amount to your guardian wallet. This is the pool of funds you draw from.',
      },
      {
        icon: 'arrow-forward-circle',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        title: 'Then send to student',
        description: 'After depositing, use "Send" to instantly transfer funds to your linked student, or set up a scheduled allowance.',
      },
    ],
  },
  {
    id: 'schedule',
    type: 'feature',
    gradientStart: '#0284C7',
    gradientEnd: '#0369A1',
    heading: 'Schedule Allowance',
    subheading: 'Set up automatic recurring transfers',
    sections: [
      {
        icon: 'calendar',
        iconColor: '#0284C7',
        iconBg: '#E0F2FE',
        title: 'Auto-Allowance',
        description: 'Set a fixed amount to automatically send to your student daily, weekly, or monthly — no manual action needed.',
      },
      {
        icon: 'repeat',
        iconColor: '#7C3AED',
        iconBg: '#EDE9FE',
        title: 'Flexible Frequency',
        description: 'Choose daily, weekly, or monthly. Funds are deducted from your guardian wallet automatically.',
      },
    ],
  },
  {
    id: 'spending-limit',
    type: 'feature',
    gradientStart: '#DC2626',
    gradientEnd: '#991B1B',
    heading: 'Spending Limit',
    subheading: 'Keep your student\'s spending in check',
    sections: [
      {
        icon: 'shield-checkmark',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        title: 'Daily Limit',
        description: 'Set a maximum amount your student can spend per day. Once reached, all expense attempts are blocked until the next day.',
      },
      {
        icon: 'eye',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        title: 'Track Spending',
        description: "The dashboard shows today's spent vs. remaining limit in real time, so you always know where things stand.",
      },
    ],
  },
  {
    id: 'invite-student',
    type: 'feature',
    gradientStart: '#0891B2',
    gradientEnd: '#155E75',
    heading: 'Link a Student',
    subheading: 'Connect with your student\'s account',
    sections: [
      {
        icon: 'person-add',
        iconColor: '#0891B2',
        iconBg: '#CFFAFE',
        title: 'Send an Invite',
        description: 'Tap "Add another student" (or the invite banner) and enter your student\'s email. They\'ll receive an invite to accept.',
      },
      {
        icon: 'checkmark-circle',
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        title: 'Accepted & Linked',
        description: 'Once the student accepts, you\'re linked! Their balance, goals, and spending become visible on your dashboard.',
      },
    ],
  },
  {
    id: 'guardian-done',
    type: 'welcome',
    gradientStart: '#7C3AED',
    gradientEnd: '#4F46E5',
    heading: "You're all set! 🎉",
    subheading:
      "Start by depositing funds into your wallet, then link a student account. From there, you can send allowances, set limits, and track spending — all in one place.",
  },
];

const STUDENT_SLIDES: Slide[] = [
  {
    id: 'welcome-student',
    type: 'welcome',
    gradientStart: '#9B1C1C',
    gradientEnd: '#B45309',
    heading: 'Welcome, Student! 🎒',
    subheading:
      'This guide will show you how to track your allowance, log expenses, set savings goals, and cash out. Swipe to learn more!',
  },
  {
    id: 'testing-notice-student',
    type: 'warning',
    gradientStart: '#D97706',
    gradientEnd: '#B45309',
    heading: '⚠️ Testing Mode',
    subheading: 'Important notice before you begin',
    warningText:
      'This app is currently for TESTING purposes only. No real money is involved. All transactions, balances, and features are simulated. Please do not use real financial information.',
  },
  {
    id: 'student-dashboard',
    type: 'dashboard',
    gradientStart: '#9B1C1C',
    gradientEnd: '#B45309',
    heading: 'Your Dashboard',
    subheading: 'Everything you need to manage your allowance',
    sections: [
      {
        icon: 'wallet',
        iconColor: '#9B1C1C',
        iconBg: '#FEE2E2',
        title: 'Available Balance',
        description: "Your current allowance balance. This increases when your guardian sends money, and decreases when you log an expense.",
      },
      {
        icon: 'bar-chart',
        iconColor: '#8B5CF6',
        iconBg: '#F5F3FF',
        title: 'Weekly Breakdown',
        description: 'See where your money went this week, broken down by category (Food, Transport, School, etc.) with a visual bar.',
      },
      {
        icon: 'flag',
        iconColor: '#10B981',
        iconBg: '#DCFCE7',
        title: 'Savings Goals',
        description: 'Your active savings goals appear here with progress bars so you can see how close you are to each target.',
      },
    ],
  },
  {
    id: 'expense',
    type: 'feature',
    gradientStart: '#DC2626',
    gradientEnd: '#991B1B',
    heading: 'Log an Expense',
    subheading: 'Track where your allowance goes',
    sections: [
      {
        icon: 'remove-circle',
        iconColor: '#DC2626',
        iconBg: '#FEE2E2',
        title: 'Add Expense',
        description: 'Tap "Expense" and enter the amount, a description, and a category (Food, Transport, School, Fun, or Other).',
      },
      {
        icon: 'shield',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        title: 'Spending Limit',
        description: "If your guardian set a daily limit, you can't spend beyond it. A banner will warn you when you're getting close.",
      },
    ],
  },
  {
    id: 'goals',
    type: 'feature',
    gradientStart: '#065F46',
    gradientEnd: '#047857',
    heading: 'Savings Goals',
    subheading: 'Save toward things that matter',
    sections: [
      {
        icon: 'flag',
        iconColor: '#10B981',
        iconBg: '#DCFCE7',
        title: 'Create a Goal',
        description: 'Name your goal, set a target amount, and pick an icon. Examples: new phone, school trip, gaming gear.',
      },
      {
        icon: 'trending-up',
        iconColor: '#0284C7',
        iconBg: '#E0F2FE',
        title: 'Contribute',
        description: 'Move money from your balance into a goal. It stays safe there until you delete the goal (funds return to balance).',
      },
    ],
  },
  {
    id: 'cashout',
    type: 'feature',
    gradientStart: '#4F46E5',
    gradientEnd: '#7C3AED',
    heading: 'Cash Out',
    subheading: 'Withdraw your balance (simulated)',
    sections: [
      {
        icon: 'card',
        iconColor: '#4F46E5',
        iconBg: '#EDE9FE',
        title: 'How to Cash Out',
        description: 'Go to the Cash Out screen (from history or nav), enter an amount, choose a method (GCash, Maya, Bank), and confirm.',
      },
      {
        icon: 'warning',
        iconColor: '#D97706',
        iconBg: '#FEF3C7',
        title: 'Testing Only',
        description: 'Remember: this is simulated. No real money is transferred. Your balance simply decreases in the app.',
      },
    ],
  },
  {
    id: 'history',
    type: 'feature',
    gradientStart: '#7C3AED',
    gradientEnd: '#6D28D9',
    heading: 'Transaction History',
    subheading: 'See every peso in and out',
    sections: [
      {
        icon: 'receipt',
        iconColor: '#7C3AED',
        iconBg: '#EDE9FE',
        title: 'Full History',
        description: 'Tap "History" from the dashboard or bottom nav to see all your transactions — expenses, allowances received, and more.',
      },
      {
        icon: 'filter',
        iconColor: '#0891B2',
        iconBg: '#CFFAFE',
        title: 'Organized by Date',
        description: 'Transactions are sorted newest first so you can always find what happened recently.',
      },
    ],
  },
  {
    id: 'student-done',
    type: 'welcome',
    gradientStart: '#9B1C1C',
    gradientEnd: '#B45309',
    heading: "Ready to go! 🚀",
    subheading:
      "Ask your guardian to link their account and send your first allowance. Then try logging an expense or setting a savings goal. You've got this!",
  },
];

// ── AsyncStorage key ──────────────────────────────────────────────────────────
const ONBOARDING_KEY = 'onboarding_completed_v1';

export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === null; // null = never seen before
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {}
}

// ── Slide Renderer ────────────────────────────────────────────────────────────
function SlideView({ slide }: { slide: Slide }) {
  const gradients: Record<string, string> = {
    '#7C3AED': 'rgba(124,58,237,',
    '#9B1C1C': 'rgba(155,28,28,',
    '#16A34A': 'rgba(22,163,74,',
    '#0284C7': 'rgba(2,132,199,',
    '#DC2626': 'rgba(220,38,38,',
    '#0891B2': 'rgba(8,145,178,',
    '#065F46': 'rgba(6,95,70,',
    '#4F46E5': 'rgba(79,70,229,',
    '#D97706': 'rgba(217,119,6,',
    '#7C3AED2': 'rgba(109,40,217,',
  };

  const bg = slide.gradientStart;

  return (
    <View style={[styles.slide, { backgroundColor: bg }]}>
      {/* Decorative circles */}
      <View style={[styles.decCircle1, { backgroundColor: slide.gradientEnd + '60' }]} />
      <View style={[styles.decCircle2, { backgroundColor: slide.gradientEnd + '40' }]} />

      <ScrollView
        style={styles.slideScroll}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {slide.type === 'welcome' && (
          <View style={styles.centerBlock}>
            <Text style={styles.bigHeading}>{slide.heading}</Text>
            <Text style={styles.subheading}>{slide.subheading}</Text>
          </View>
        )}

        {slide.type === 'warning' && (
          <View style={styles.centerBlock}>
            <Text style={styles.bigHeading}>{slide.heading}</Text>
            {slide.subheading && <Text style={styles.subheadingSmall}>{slide.subheading}</Text>}
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={28} color="#FCD34D" style={{ marginBottom: 12 }} />
              <Text style={styles.warningText}>{slide.warningText}</Text>
            </View>
          </View>
        )}

        {(slide.type === 'dashboard' || slide.type === 'feature') && (
          <>
            <Text style={styles.featureHeading}>{slide.heading}</Text>
            {slide.subheading && <Text style={styles.featureSubheading}>{slide.subheading}</Text>}
            {slide.sections?.map((sec, i) => (
              <View key={i} style={styles.sectionCard}>
                <View style={[styles.sectionIconWrap, { backgroundColor: sec.iconBg }]}>
                  <Ionicons name={sec.icon as any} size={22} color={sec.iconColor} />
                </View>
                <View style={styles.sectionText}>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                  <Text style={styles.sectionDesc}>{sec.description}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface OnboardingTutorialProps {
  role: 'guardian' | 'student';
  onComplete: () => void;
}

export default function OnboardingTutorial({ role, onComplete }: OnboardingTutorialProps) {
  const slides = role === 'guardian' ? GUARDIAN_SLIDES : STUDENT_SLIDES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const isLast = currentIndex === slides.length - 1;
  const accentColor = role === 'guardian' ? '#7C3AED' : '#9B1C1C';

  const goTo = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
    Animated.timing(progressAnim, {
      toValue: index / (slides.length - 1),
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleNext = () => {
    if (isLast) {
      markOnboardingComplete().then(onComplete);
    } else {
      goTo(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    markOnboardingComplete().then(onComplete);
  };

  return (
    <View style={styles.container}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.slideContainer}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={{ width }}>
            <SlideView slide={slide} />
          </View>
        ))}
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)}>
              <View
                style={[
                  styles.dot,
                  i === currentIndex && { width: 24, backgroundColor: accentColor },
                  i !== currentIndex && { backgroundColor: '#D1D5DB' },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Navigation row */}
        <View style={styles.navRow}>
          {currentIndex > 0 ? (
            <Pressable onPress={() => goTo(currentIndex - 1)} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color="#6B7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}

          <Pressable onPress={handleNext} style={[styles.nextBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.nextBtnText}>{isLast ? "Let's Go!" : 'Next'}</Text>
            {!isLast && <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 4 }} />}
          </Pressable>

          {!isLast ? (
            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#fff',
  },
  slideContainer: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  decCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -80,
    right: -80,
  },
  decCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: 100,
    left: -60,
  },
  slideScroll: {
    flex: 1,
  },
  slideScrollContent: {
    padding: 32,
    paddingTop: Platform.OS === 'web' ? 60 : 80,
    paddingBottom: 20,
    minHeight: height - 160,
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigHeading: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  subheading: {
    fontSize: 17,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
  },
  subheadingSmall: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
  },
  warningBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.4)',
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#FEF3C7',
    textAlign: 'center',
    lineHeight: 24,
  },
  featureHeading: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    marginBottom: 8,
  },
  featureSubheading: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 28,
    lineHeight: 22,
  },
  sectionCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 21,
  },
  controls: {
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: 2,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
  },
  skipBtn: {
    width: 50,
    alignItems: 'flex-end',
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#9CA3AF',
  },
});
