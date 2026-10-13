import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { IndeterminateBar, useLoop } from '@/shared/ui/motion';
import { Shadow, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

/**
 * Shown while the app gets ready (fonts, then the pantry).
 *
 * Uses the system font on purpose: it can render before the bundled fonts
 * have loaded, and iOS refuses to draw a custom family it does not know yet.
 */
export function AppLoading({ message = 'Checking your pantry…' }: { message?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Blob
        color={theme.peach}
        style={{ top: -90, left: -80, width: 280, height: 280 }}
        duration={3500}
      />
      <Blob
        color={theme.mint}
        style={{ bottom: -110, right: -70, width: 300, height: 300 }}
        duration={4500}
      />
      <Blob
        color={theme.butter}
        style={{ bottom: 160, left: -40, width: 110, height: 110 }}
        duration={3200}
      />
      <Blob
        color={theme.lavender}
        style={{ top: 150, right: 20, width: 70, height: 70 }}
        duration={4000}
      />

      <View style={[styles.plate, { backgroundColor: theme.backgroundElement }]}>
        <SteamingPot />
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text }]}>
          Recet<Text style={{ color: theme.mintInk }}>App</Text>
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Cook what you already have
        </Text>
      </View>

      <View style={styles.progress} accessibilityLabel={message}>
        <IndeterminateBar color={theme.accent} />
        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      </View>
    </View>
  );
}

function Blob({
  color,
  style,
  duration,
}: {
  color: string;
  style: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    width: number;
    height: number;
  };
  duration: number;
}) {
  const breathe = useLoop(duration, { yoyo: true });

  return (
    <Animated.View
      style={[
        styles.blob,
        style,
        {
          borderRadius: style.width / 2,
          backgroundColor: color,
          transform: [
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
            { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
          ],
        },
      ]}
    />
  );
}

/** A pot that bobs, rattles its lid and lets off steam. */
export function SteamingPot() {
  const theme = useTheme();
  const bob = useLoop(1200, { yoyo: true });
  const rattle = useLoop(2400, { easing: Easing.linear });

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
      }}
    >
      <View style={styles.steamRow}>
        <Steam color={theme.lilac} delay={0} />
        <Steam color={theme.accent} delay={600} />
        <Steam color={theme.coral} delay={1200} />
      </View>
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            {
              translateY: rattle.interpolate({
                inputRange: [0, 0.7, 0.78, 0.86, 1],
                outputRange: [0, 0, -5, -2, 0],
              }),
            },
            {
              rotate: rattle.interpolate({
                inputRange: [0, 0.7, 0.78, 0.86, 1],
                outputRange: ['0deg', '0deg', '-6deg', '4deg', '0deg'],
              }),
            },
          ],
        }}
      >
        <View style={[styles.knob, { backgroundColor: theme.text }]} />
        <View style={[styles.lid, { backgroundColor: theme.text }]} />
      </Animated.View>
      <View style={styles.potRow}>
        <View style={[styles.handle, { backgroundColor: theme.text }]} />
        <View style={[styles.pot, { backgroundColor: theme.peach, borderColor: theme.text }]} />
        <View style={[styles.handle, { backgroundColor: theme.text }]} />
      </View>
    </Animated.View>
  );
}

function Steam({ color, delay }: { color: string; delay: number }) {
  const rise = useLoop(2200, { delay, easing: Easing.out(Easing.quad) });

  return (
    <Animated.View
      style={[
        styles.steam,
        {
          backgroundColor: color,
          opacity: rise.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, -22] }) },
            { scaleX: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, overflow: 'hidden' },
  blob: { position: 'absolute' },
  plate: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  titleBlock: { alignItems: 'center', gap: Spacing.one },
  title: { fontSize: 44, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 16 },
  progress: { alignItems: 'center', gap: Spacing.three },
  message: { fontSize: 13 },
  steamRow: { flexDirection: 'row', gap: 10, height: 26, alignItems: 'flex-end', marginBottom: 2 },
  steam: { width: 4, height: 16, borderRadius: 2 },
  knob: { width: 12, height: 4, borderRadius: 2 },
  lid: { width: 58, height: 4, borderRadius: 2, marginTop: 2 },
  potRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 3 },
  handle: { width: 9, height: 4, borderRadius: 2, marginTop: 8 },
  pot: {
    width: 58,
    height: 36,
    borderWidth: 3,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
});
