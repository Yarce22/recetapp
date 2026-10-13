import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { weekDates, type MealPlanEntryDto, type MealSlot } from '@recetapp/contracts';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Badge, IconTile, type IconName } from '@/shared/ui/controls';
import { FadeIn, Skeleton, Spinner, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

const SLOT_STYLE: Record<MealSlot, { icon: IconName; tone: Tone }> = {
  breakfast: { icon: 'cafe-outline', tone: 'butter' },
  lunch: { icon: 'sunny-outline', tone: 'mint' },
  dinner: { icon: 'moon-outline', tone: 'lavender' },
};

export type WeeklyGridProps = {
  weekStartDate: string;
  slots: MealSlot[];
  entries: MealPlanEntryDto[];
  /** The day currently being regenerated, if any. */
  busyDate: string | null;
  /** Today's ISO date, highlighted when it falls in this week. */
  today?: string;
  onSelect: (entry: MealPlanEntryDto) => void;
  onClear: (date: string, slot: MealSlot) => void;
  onRegenerateDay: (date: string) => void;
  /** Reports where each day's card sits, so a parent can scroll to it. */
  onDayLayout?: (date: string, y: number) => void;
};

export function WeeklyGrid({
  weekStartDate,
  slots,
  entries,
  busyDate,
  today,
  onSelect,
  onClear,
  onRegenerateDay,
  onDayLayout,
}: WeeklyGridProps) {
  const theme = useTheme();
  const { t, weekdayName } = useTranslation();
  // Day names come from the position in the week, not from the date:
  // `weekDates` guarantees Monday first, and formatting the date would
  // reintroduce the timezone the ISO dates exist to avoid.
  const days = weekDates(weekStartDate);

  const find = (date: string, slot: MealSlot) =>
    entries.find((entry) => entry.date === date && entry.slot === slot) ?? null;

  return (
    <View style={styles.week}>
      {days.map((date, index) => {
        const dayName = weekdayName(index);
        const busy = busyDate === date;
        const isToday = date === today;

        return (
          <FadeIn
            key={date}
            delay={stagger(index, 60)}
            onLayout={(event) => onDayLayout?.(date, event.nativeEvent.layout.y)}
          >
            <View
              style={[
                styles.day,
                { backgroundColor: busy ? theme.lavender : theme.backgroundElement },
                isToday && { borderColor: theme.accent, borderWidth: 2 },
              ]}
            >
              <View style={styles.dayHeader}>
                <View style={styles.dayTitle}>
                  <ThemedText type="subtitle">{dayName}</ThemedText>
                  {isToday ? <Badge label={t('grid.today')} tone="mint" /> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('grid.regenerateDay', { day: dayName })}
                  accessibilityState={{ disabled: busy, busy }}
                  onPress={() => !busy && onRegenerateDay(date)}
                  hitSlop={4}
                  style={[
                    styles.shuffle,
                    { backgroundColor: busy ? theme.backgroundElement : theme.track },
                  ]}
                >
                  {busy ? (
                    <Spinner size={20} color={theme.lilac} />
                  ) : (
                    <Ionicons name="shuffle" size={18} color={theme.text} />
                  )}
                </Pressable>
              </View>

              {slots.map((slot) => {
                const entry = find(date, slot);
                const slotStyle = SLOT_STYLE[slot];
                const mealName = t(`meal.${slot}`);

                return (
                  <View key={slot} style={styles.slot}>
                    <IconTile icon={slotStyle.icon} tone={slotStyle.tone} size={40} />
                    <View style={styles.slotBody}>
                      {slots.length > 1 ? (
                        <ThemedText
                          type="eyebrow"
                          themeColor="textSecondary"
                          style={styles.slotName}
                        >
                          {mealName}
                        </ThemedText>
                      ) : null}

                      {busy ? (
                        <View style={styles.busyLines}>
                          <Skeleton width="80%" height={12} />
                          <Skeleton width="45%" height={9} />
                        </View>
                      ) : entry ? (
                        <Pressable accessibilityRole="button" onPress={() => onSelect(entry)}>
                          <ThemedText type="smallBold" style={styles.dish}>
                            {entry.dishTitle}
                          </ThemedText>
                        </Pressable>
                      ) : (
                        // An empty slot says so. A blank row reads like a bug.
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('grid.empty')}
                        </ThemedText>
                      )}
                    </View>

                    {entry && !busy ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('grid.clearMeal', { meal: mealName, day: dayName })}
                        onPress={() => onClear(date, slot)}
                        hitSlop={10}
                        style={styles.clear}
                      >
                        <Ionicons name="close" size={18} color={theme.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </FadeIn>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { gap: Spacing.three, paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  day: { padding: Spacing.three, borderRadius: Radius.xl, gap: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  shuffle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  slotBody: { flex: 1, gap: 2 },
  slotName: { textTransform: 'uppercase' },
  dish: { fontSize: 15 },
  busyLines: { gap: 6, paddingVertical: 4 },
  clear: { padding: Spacing.one },
});
