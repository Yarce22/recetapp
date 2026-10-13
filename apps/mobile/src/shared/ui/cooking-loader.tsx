import { Animated, Easing, StyleSheet, View } from 'react-native';

import { BouncingDots, useLoop } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type CookingLoaderProps = {
  /** What is being waited for, e.g. "Mixing your ingredients". */
  label: string;
  hint?: string;
};

/**
 * The wait for the model: ingredients drop into a bowl while a spoon stirs.
 * Built from plain views so it needs no SVG dependency.
 */
export function CookingLoader({ label, hint }: CookingLoaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.stage}>
        <PulseRing color={theme.butter} delay={0} />
        <PulseRing color={theme.lavender} delay={1000} />

        <Falling color={theme.coral} left={48} delay={0} shape="round" />
        <Falling color={theme.accent} left={78} delay={800} shape="leaf" />
        <Falling color={theme.honey} left={104} delay={1600} shape="cube" />

        <Spoon color={theme.text} fill={theme.backgroundElement} />

        <View
          style={[
            styles.bowl,
            { borderColor: theme.text, backgroundColor: theme.backgroundElement },
          ]}
        >
          <View style={[styles.broth, { backgroundColor: theme.mint }]} />
        </View>
      </View>

      <View style={styles.labelRow}>
        <ThemedText type="subtitle">{label}</ThemedText>
        <BouncingDots color={theme.accent} />
      </View>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function PulseRing({ color, delay }: { color: string; delay: number }) {
  const pulse = useLoop(2000, { delay, easing: Easing.out(Easing.quad) });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] }) },
          ],
        },
      ]}
    />
  );
}

function Falling({
  color,
  left,
  delay,
  shape,
}: {
  color: string;
  left: number;
  delay: number;
  shape: 'round' | 'leaf' | 'cube';
}) {
  const drop = useLoop(2400, { delay, easing: Easing.in(Easing.quad) });
  const size =
    shape === 'cube'
      ? { width: 18, height: 14, borderRadius: 5 }
      : shape === 'leaf'
        ? {
            width: 15,
            height: 21,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderBottomLeftRadius: 7,
            borderBottomRightRadius: 7,
          }
        : { width: 18, height: 18, borderRadius: 9 };

  return (
    <Animated.View
      style={[
        styles.falling,
        size,
        {
          left,
          backgroundColor: color,
          opacity: drop.interpolate({
            inputRange: [0, 0.15, 0.6, 0.75, 1],
            outputRange: [0, 1, 1, 0, 0],
          }),
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [-70, 0, 6] }) },
            { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
          ],
        },
      ]}
    />
  );
}

function Spoon({ color, fill }: { color: string; fill: string }) {
  const stir = useLoop(600, { yoyo: true });

  return (
    <Animated.View
      style={[
        styles.spoon,
        {
          transform: [
            { translateY: 40 },
            { rotate: stir.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '16deg'] }) },
            { translateY: -40 },
          ],
        },
      ]}
    >
      <View style={[styles.spoonHandle, { backgroundColor: color }]} />
      <View style={[styles.spoonHead, { borderColor: color, backgroundColor: fill }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  stage: { width: 170, height: 160, alignItems: 'center', justifyContent: 'flex-end' },
  ring: { position: 'absolute', top: 30, left: 25, width: 120, height: 120, borderRadius: 60 },
  falling: { position: 'absolute', top: 72 },
  spoon: { position: 'absolute', left: 92, top: 18, alignItems: 'center' },
  spoonHandle: { width: 4, height: 62, borderRadius: 2 },
  spoonHead: { width: 16, height: 22, borderRadius: 9, borderWidth: 3, marginTop: -4 },
  bowl: {
    width: 150,
    height: 72,
    borderWidth: 3,
    borderBottomLeftRadius: 75,
    borderBottomRightRadius: 75,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
  },
  broth: { marginTop: 10, width: 112, height: 7, borderRadius: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: { textAlign: 'center', paddingHorizontal: Spacing.four },
});
