import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  type EasingFunction,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

/**
 * True when the user asked the OS for less motion. Looping animations check
 * it and stay still; entrances jump straight to their final state.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

type LoopOptions = {
  delay?: number;
  easing?: EasingFunction;
  /** Play forward then backward instead of jumping back to the start. */
  yoyo?: boolean;
};

/** An Animated.Value that runs 0 → 1 forever (on the native driver). */
export function useLoop(duration: number, { delay = 0, easing, yoyo = false }: LoopOptions = {}) {
  const [value] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      value.setValue(0);
      return;
    }

    const ease = easing ?? Easing.inOut(Easing.ease);
    const forward = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: ease,
      useNativeDriver: true,
    });
    const cycle = yoyo
      ? Animated.sequence([
          forward,
          Animated.timing(value, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
        ])
      : forward;

    const animation = Animated.sequence([Animated.delay(delay), Animated.loop(cycle)]);
    animation.start();
    return () => animation.stop();
  }, [value, reduced, duration, delay, easing, yoyo]);

  return value;
}

export type FadeInProps = {
  /** Milliseconds before this element starts appearing. Stagger lists with it. */
  delay?: number;
  /** How far below its place the element starts, in px. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
};

/** Fades and slides its children up into place once, on mount. */
export function FadeIn({ delay = 0, distance = 14, style, onLayout, children }: FadeInProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Stagger helper: the delay for the item at `index` in a list. */
export function stagger(index: number, step = 70, start = 80): number {
  // Capped so long lists do not keep the last rows waiting.
  return start + Math.min(index, 8) * step;
}

export type SkeletonProps = {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block with a light band sweeping across it. */
export function Skeleton({ width = '100%', height, radius = Radius.pill, style }: SkeletonProps) {
  const theme = useTheme();
  const sweep = useLoop(1300, { easing: Easing.linear });
  const [boxWidth, setBoxWidth] = useState(0);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.track, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 90,
          backgroundColor: theme.shimmer,
          transform: [
            {
              translateX: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [-90, Math.max(boxWidth, 1)],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

export type ProgressBarProps = {
  /** 0 to 1. */
  value: number;
  color: string;
  trackColor?: string;
  height?: number;
  accessibilityLabel?: string;
};

/** A bar that grows to `value`, and animates whenever `value` changes. */
export function ProgressBar({
  value,
  color,
  trackColor,
  height = 8,
  accessibilityLabel,
}: ProgressBarProps) {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const target = Math.max(0, Math.min(1, value));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: target,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, target]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: height,
        backgroundColor: trackColor ?? theme.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width: '100%',
          borderRadius: height,
          backgroundColor: color,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-Math.max(width, 1), 0],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

/** A band that slides back and forth: progress with no known end. */
export function IndeterminateBar({ color, width = 200 }: { color: string; width?: number }) {
  const theme = useTheme();
  const slide = useLoop(1100, { yoyo: true });

  return (
    <View
      accessibilityRole="progressbar"
      style={{
        width,
        height: 8,
        borderRadius: 8,
        backgroundColor: theme.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: width * 0.45,
          height: '100%',
          borderRadius: 8,
          backgroundColor: color,
          transform: [
            {
              translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.55] }),
            },
          ],
        }}
      />
    </View>
  );
}

/** Ring that spins: a short wait the user started. */
export function Spinner({ size = 24, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const turn = useLoop(900, { easing: Easing.linear });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(3, size / 7),
        borderColor: theme.track,
        borderTopColor: color ?? theme.accent,
        transform: [
          { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    />
  );
}

/** Three dots hopping in turn, for "thinking…" labels. */
export function BouncingDots({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <View
      style={{ flexDirection: 'row', gap: size * 0.7, alignItems: 'flex-end', height: size * 2.2 }}
    >
      {[0, 150, 300].map((delay) => (
        <Dot key={delay} delay={delay} color={color} size={size} />
      ))}
    </View>
  );
}

function Dot({ delay, color, size }: { delay: number; color: string; size: number }) {
  const hop = useLoop(420, { delay, yoyo: true });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: hop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [
          { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size] }) },
        ],
      }}
    />
  );
}
