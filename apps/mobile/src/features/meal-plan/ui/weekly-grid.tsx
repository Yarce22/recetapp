import { Pressable, StyleSheet, View } from 'react-native';

import { weekDates, type MealPlanEntryDto, type MealSlot } from '@recetapp/contracts';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

/**
 * Day names indexed by position in the week, not derived from the date.
 *
 * `toLocaleDateString` would reintroduce the timezone the ISO dates exist to
 * avoid, and `weekDates` already guarantees the order starts on Monday.
 */
const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeeklyGridProps = {
  weekStartDate: string;
  slots: MealSlot[];
  entries: MealPlanEntryDto[];
  /** The day currently being regenerated, if any. */
  busyDate: string | null;
  onSelect: (entry: MealPlanEntryDto) => void;
  onClear: (date: string, slot: MealSlot) => void;
  onRegenerateDay: (date: string) => void;
};

export function WeeklyGrid({
  weekStartDate,
  slots,
  entries,
  busyDate,
  onSelect,
  onClear,
  onRegenerateDay,
}: WeeklyGridProps) {
  const theme = useTheme();
  const days = weekDates(weekStartDate);

  const find = (date: string, slot: MealSlot) =>
    entries.find((entry) => entry.date === date && entry.slot === slot) ?? null;

  return (
    <View style={styles.week}>
      {days.map((date, index) => {
        const dayName = DAY_NAMES[index];
        const busy = busyDate === date;

        return (
          <View key={date} style={[styles.day, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.dayHeader}>
              <ThemedText type="smallBold">{dayName}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Plan something else for ${dayName}`}
                accessibilityState={{ disabled: busy }}
                onPress={() => !busy && onRegenerateDay(date)}
                style={[
                  styles.dayAction,
                  { backgroundColor: theme.backgroundSelected, opacity: busy ? 0.5 : 1 },
                ]}
              >
                <ThemedText type="small">{busy ? '...' : 'Shuffle'}</ThemedText>
              </Pressable>
            </View>

            {slots.map((slot) => {
              const entry = find(date, slot);

              return (
                <View key={slot} style={styles.slot}>
                  {slots.length > 1 ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.slotName}>
                      {slot}
                    </ThemedText>
                  ) : null}

                  {entry ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => onSelect(entry)}
                        style={styles.dish}
                      >
                        <ThemedText type="small">{entry.dishTitle}</ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Clear ${slot} on ${dayName}`}
                        onPress={() => onClear(date, slot)}
                        style={styles.clear}
                      >
                        <ThemedText type="small" themeColor="textSecondary">
                          x
                        </ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    // An empty slot says so. A blank row reads like a bug.
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dish}>
                      Nothing planned
                    </ThemedText>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { gap: Spacing.two, padding: Spacing.three },
  day: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayAction: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  slot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  slotName: { width: 64 },
  dish: { flex: 1 },
  clear: { paddingHorizontal: Spacing.two },
});
