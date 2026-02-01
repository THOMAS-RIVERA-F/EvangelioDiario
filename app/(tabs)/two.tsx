import { Image, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import lecturasRaw from '@/data/lecturas_2026.json';

type LecturasDay = {
  date: string;
  date_display: string;
  title: string;
};

const lecturas = lecturasRaw as { days: LecturasDay[] };
const HINRY_CADENA = require('@/assets/mascot/hinry_rezando_cadena.png');

const MONTHS = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

const IMPORTANT_KEYWORDS = [
  'solemnidad',
  'fiesta',
  'domingo',
  'pascua',
  'pentecostes',
  'adviento',
  'navidad',
  'cuaresma',
  'semana santa',
  'miercoles de ceniza',
  'triduo',
  'epifania',
  'cristo rey',
  'ascension',
  'bautismo del senor',
  'corpus christi',
  'inmaculada',
  'sagrado corazon',
];

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isImportant(day: LecturasDay) {
  const normalized = normalizeText(day.title);
  return IMPORTANT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export default function TabTwoScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const todayKey = formatLocalISO(new Date());
  const [mode, setMode] = useState<'important' | 'all'>('important');

  const filteredDays = useMemo(() => {
    if (mode === 'all') return lecturas.days;
    return lecturas.days.filter(isImportant);
  }, [mode]);

  const sections = useMemo(() => {
    const map = new Map<string, LecturasDay[]>();
    filteredDays.forEach((day) => {
      const [year, month] = day.date.split('-');
      const monthIndex = Number(month) - 1;
      const key = `${MONTHS[monthIndex]} ${year}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(day);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredDays]);

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Calendario</Text>
              <Text style={[styles.headerSubtitle, { color: Colors[colorScheme].muted }]}>
                Fechas liturgicas destacadas
              </Text>
              <View
                style={[
                  styles.segment,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}>
                {([
                  { key: 'important', label: 'Importantes' },
                  { key: 'all', label: 'Todo' },
                ] as const).map((option) => {
                  const selected = mode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setMode(option.key)}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        selected && {
                          backgroundColor:
                            colorScheme === 'dark'
                              ? 'rgba(226, 200, 160, 0.2)'
                              : 'rgba(177, 136, 74, 0.18)',
                        },
                        pressed && { opacity: 0.7 },
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          { color: selected ? Colors[colorScheme].text : Colors[colorScheme].muted },
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Image source={HINRY_CADENA} style={styles.headerMascot} resizeMode="contain" />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme].muted }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const dayNumber = Number(item.date.slice(8, 10));
          const dayLabel = item.date_display.split(',')[0];
          const isToday = item.date === todayKey;
          return (
            <View
              style={[
                styles.row,
                isToday && {
                  backgroundColor:
                    colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                },
              ]}>
              <Text style={[styles.dayNumber, { color: Colors[colorScheme].tint }]}>
                {dayNumber}
              </Text>
              <View style={styles.rowText}>
                <Text style={[styles.date, { color: Colors[colorScheme].muted }]}>
                  {dayLabel.toUpperCase()}
                </Text>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerText: {
    gap: Spacing.xs,
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
  },
  headerSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  headerMascot: {
    width: 96,
    height: 96,
    opacity: 0.9,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  segmentText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  sectionTitle: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'flex-start',
  },
  dayNumber: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
    lineHeight: LineHeight.title,
    minWidth: 28,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.xs,
  },
  date: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: 'Lora_500Medium',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
});
