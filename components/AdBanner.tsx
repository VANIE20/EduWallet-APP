import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AD_HEIGHT = SCREEN_WIDTH * 0.4;

const ADS = [
  require('../assets/ad-eduwallet.png'),
  require('../assets/ad1-eduwallet.png'),
  require('../assets/ad2-eduwallet.png'),
  require('../assets/ad3-eduwallet.png'),
];

const AD_PROMOS = [
  { badge: 'LIMITED OFFER', headline: 'Send Allowance FREE', badgeColor: '#FF4D4D' },
  { badge: 'FLASH SALE', headline: '50% Savings Bonus!', badgeColor: '#F59E0B' },
  { badge: 'EXCLUSIVE', headline: 'Free Cash-G Cash Out', badgeColor: '#10B981' },
  { badge: 'PROMO', headline: 'Double Your Goal!', badgeColor: '#6B0F1A' },
];

const AD_INTERVAL = 4000;

interface AdBannerProps {
  style?: ViewStyle;
}

export default function AdBanner({ style }: AdBannerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScrolling = useRef(false);

  const scrollTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, ADS.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
    setActiveIndex(clamped);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (isScrolling.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
        return next;
      });
    }, AD_INTERVAL);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SCREEN_WIDTH);
    setActiveIndex(index);
    isScrolling.current = false;
    startTimer();
  };

  const onScrollBegin = () => {
    isScrolling.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const promo = AD_PROMOS[activeIndex];

  return (
    <View style={[styles.wrapper, style]}>
      {/* Image slider */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBegin}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={{ width: SCREEN_WIDTH }}
      >
        {ADS.map((ad, i) => (
          <Image
            key={i}
            source={ad}
            style={{ width: SCREEN_WIDTH, height: AD_HEIGHT }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Promo row */}
      <View style={styles.promoRow}>
        <View style={[styles.badge, { backgroundColor: promo.badgeColor }]}>
          <Text style={styles.badgeText}>{promo.badge}</Text>
        </View>
        <Text style={styles.headline} numberOfLines={1}>{promo.headline}</Text>
      </View>

      {/* Dots centered below promo */}
      <View style={styles.dots}>
        {ADS.map((_, i) => (
          <Pressable key={i} onPress={() => scrollTo(i)} hitSlop={8}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 8,
    width: '100%',
    alignItems: 'center',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 6,
    width: SCREEN_WIDTH,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.3,
  },
  headline: {
    flex: 1,
    color: '#1a1a1a',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B0F1A',
  },
});