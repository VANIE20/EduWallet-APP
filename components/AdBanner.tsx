import React, { useEffect, useRef, useState } from 'react';
import {
  View, Image, StyleSheet, Animated, Dimensions, Pressable, ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ADS = [
  require('../assets/ad-eduwallet.png'),
  require('../assets/ad1-eduwallet.png'),
];

const AD_INTERVAL = 6000;

interface AdBannerProps {
  width?: number | `${number}%`;   // default: full screen width (edge-to-edge)
  height?: number;                  // default: 160
  borderRadius?: number;            // default: 0 for full-width, 16 for custom size
  style?: ViewStyle;                // extra wrapper styles if needed
}

export default function AdBanner({
  width,
  height = 160,
  borderRadius,
  style,
}: AdBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // If no width given → bleed edge-to-edge; otherwise use the given width
  const isFullWidth = width === undefined;
  const resolvedRadius = borderRadius ?? (isFullWidth ? 0 : 16);

  const containerStyle: ViewStyle = isFullWidth
    ? {
        width: SCREEN_WIDTH,
        marginHorizontal: -24,   // bleed past parent's 24px padding
      }
    : {
        width: width as any,
        alignSelf: 'center',
      };

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(prev => (prev + 1) % ADS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration:450,
          useNativeDriver: true,
        }).start();
      });
    }, AD_INTERVAL);

    return () => clearInterval(timer);
  }, [fadeAnim]);

  const goTo = (index: number) => {
    if (index === currentIndex) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(index);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <View style={[containerStyle, { marginBottom: 24 }, style]}>
      <Animated.View
        style={{
          width: '100%',
          height,
          borderRadius: resolvedRadius,
          overflow: 'hidden',
          opacity: fadeAnim,
        }}
      >
        <Image
          source={ADS[currentIndex]}
          style={styles.image}
          resizeMode="stretch"
        />
      </Animated.View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {ADS.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
            <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '95%',
    marginHorizontal: 10,
    // Fix: Use React Native border properties
    borderWidth: 2,
    borderColor: 'maroon',
    borderStyle: 'solid', 
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#475569',
    borderRadius: 3,
  },
});