import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import lecturasRaw from '@/data/lecturas_2026.json';

type LecturasDay = {
  date: string;
  date_display: string;
  title: string;
  color?: string;
  reading_sets?: Array<{
    readings?: Array<{
      type: string;
      reference: string;
      verses?: Array<{ number?: string; text: string }>;
    }>;
  }>;
};

type CalendarDay = {
  date: string;
  date_display: string;
  title: string;
  color?: string;
  season: SeasonName;
  evangelioReference: string;
  evangelioText: string;
  evangelioVerses: Array<{ number?: string; text: string }>;
  hasData: boolean;
  dayOfYear: number;
};

type Mode = 'important' | 'circular' | 'calendar';
type SeasonName =
  | 'Adviento'
  | 'Navidad'
  | 'Tiempo Ordinario'
  | 'Cuaresma'
  | 'Triduo Pascual'
  | 'Tiempo Pascual';

const lecturas = lecturasRaw as { days: LecturasDay[] };
const HINRY_CADENA = require('@/assets/mascot/hinry_rezando_cadena.png');
const YEAR = 2026;

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

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const SEASON_COLORS: Record<SeasonName, string> = {
  Adviento: '#7E57C2',
  Navidad: '#EAD58C',
  'Tiempo Ordinario': '#4CAF50',
  Cuaresma: '#7A3E99',
  'Triduo Pascual': '#D64541',
  'Tiempo Pascual': '#F3E7B6',
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatISO(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPrettyDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function nextSundayAfter(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const delta = day === 0 ? 7 : 7 - day;
  return addDays(d, delta);
}

function firstSundayOnOrAfter(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  return addDays(d, (7 - day) % 7);
}

function computeEasterGregorian(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month - 1, day);
}

function computeLiturgicalBoundaries(year: number) {
  const easter = computeEasterGregorian(year);
  const ashWednesday = addDays(easter, -46);
  const palmSunday = addDays(easter, -7);
  const holyThursday = addDays(easter, -3);
  const goodFriday = addDays(easter, -2);
  const holySaturday = addDays(easter, -1);
  const pentecost = addDays(easter, 49);
  const epiphany = utcDate(year, 0, 6);
  const baptismOfLord = nextSundayAfter(epiphany);
  const adventStart = firstSundayOnOrAfter(utcDate(year, 10, 27));
  const christmasStart = utcDate(year, 11, 25);

  return {
    ashWednesday,
    palmSunday,
    holyThursday,
    goodFriday,
    holySaturday,
    easter,
    pentecost,
    baptismOfLord,
    adventStart,
    christmasStart,
  };
}

function seasonForDate(date: Date, b: ReturnType<typeof computeLiturgicalBoundaries>): SeasonName {
  const holyWednesday = addDays(b.easter, -4);
  const ordinaryAfterPentecost = addDays(b.pentecost, 1);
  const dayBeforeAdvent = addDays(b.adventStart, -1);

  if (inRange(date, utcDate(YEAR, 0, 1), b.baptismOfLord)) return 'Navidad';
  if (inRange(date, addDays(b.baptismOfLord, 1), addDays(b.ashWednesday, -1))) return 'Tiempo Ordinario';
  if (inRange(date, b.ashWednesday, holyWednesday)) return 'Cuaresma';
  if (inRange(date, b.holyThursday, b.holySaturday)) return 'Triduo Pascual';
  if (inRange(date, b.easter, b.pentecost)) return 'Tiempo Pascual';
  if (inRange(date, ordinaryAfterPentecost, dayBeforeAdvent)) return 'Tiempo Ordinario';
  if (inRange(date, b.adventStart, addDays(b.christmasStart, -1))) return 'Adviento';
  if (inRange(date, b.christmasStart, utcDate(YEAR, 11, 31))) return 'Navidad';

  return 'Tiempo Ordinario';
}

function getEvangelio(day?: LecturasDay) {
  if (!day) {
    return {
      reference: 'No disponible',
      text: 'No hay evangelio cargado para este día en el JSON.',
      verses: [] as Array<{ number?: string; text: string }>,
    };
  }

  const sets = Array.isArray(day.reading_sets) ? day.reading_sets : [];
  const readings = sets.flatMap((set) => (Array.isArray(set.readings) ? set.readings : []));
  const evangelio =
    readings.find((reading) => String(reading.type).toLowerCase().includes('evangelio')) ||
    readings[0];

  if (!evangelio) {
    return {
      reference: 'No disponible',
      text: 'No hay evangelio cargado para este día.',
      verses: [] as Array<{ number?: string; text: string }>,
    };
  }

  const verses = Array.isArray(evangelio.verses) ? evangelio.verses : [];
  const text = verses
    .map((verse) => `${verse.number ? `${verse.number} ` : ''}${verse.text ?? ''}`.trim())
    .filter(Boolean)
    .join('\n');

  return {
    reference: evangelio.reference || 'No disponible',
    text: text || 'No hay texto del evangelio para este día.',
    verses: verses.map((verse) => ({ number: verse.number, text: verse.text })),
  };
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isImportantTitle(title: string) {
  const normalized = normalizeText(title);
  const terms = [
    'solemnidad',
    'fiesta',
    'pascua',
    'pentecostes',
    'adviento',
    'navidad',
    'cuaresma',
    'semana santa',
    'ceniza',
    'triduo',
    'epifania',
    'cristo rey',
    'ascension',
    'corpus christi',
    'inmaculada',
  ];
  return terms.some((term) => normalized.includes(term));
}

function isStrictOfficialTitle(title: string) {
  const normalized = normalizeText(title);
  return ['solemnidad', 'fiesta', 'memoria'].some((term) => normalized.includes(term));
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function ringPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function TabTwoScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('important');
  const [selectedDate, setSelectedDate] = useState('2026-01-01');
  const [activeSeason, setActiveSeason] = useState<SeasonName | null>(null);
  const [seasonMonthFilter, setSeasonMonthFilter] = useState<number | 'all'>('all');
  const [seasonDayFilter, setSeasonDayFilter] = useState<number | 'all'>('all');
  const [seasonListLimit, setSeasonListLimit] = useState(10);
  const [strictImportantOnly, setStrictImportantOnly] = useState(false);

  const boundaries = useMemo(() => computeLiturgicalBoundaries(YEAR), []);

  const allDays = useMemo(() => {
    const sourceMap = new Map(lecturas.days.map((day) => [day.date, day]));
    const start = utcDate(YEAR, 0, 1);
    const rows: CalendarDay[] = [];

    for (let index = 0; index < 365; index += 1) {
      const date = addDays(start, index);
      const iso = formatISO(date);
      const source = sourceMap.get(iso);
      const evangelio = getEvangelio(source);

      rows.push({
        date: iso,
        date_display: source?.date_display || formatPrettyDate(iso),
        title: source?.title || 'Sin celebración registrada',
        color: source?.color,
        season: seasonForDate(date, boundaries),
        evangelioReference: evangelio.reference,
        evangelioText: evangelio.text,
        evangelioVerses: evangelio.verses,
        hasData: !!source,
        dayOfYear: index + 1,
      });
    }

    return rows;
  }, [boundaries]);

  const dayMap = useMemo(() => new Map(allDays.map((day) => [day.date, day])), [allDays]);
  const selectedDay = dayMap.get(selectedDate) || allDays[0];

  const circularDays = useMemo(() => allDays.filter((day) => day.hasData), [allDays]);

  const milestones = useMemo(
    () => [
      { label: 'Miércoles de Ceniza', date: formatISO(boundaries.ashWednesday) },
      { label: 'Domingo de Ramos', date: formatISO(boundaries.palmSunday) },
      { label: 'Jueves Santo', date: formatISO(boundaries.holyThursday) },
      { label: 'Viernes Santo', date: formatISO(boundaries.goodFriday) },
      { label: 'Domingo de Pascua', date: formatISO(boundaries.easter) },
      { label: 'Pentecostés', date: formatISO(boundaries.pentecost) },
      { label: 'Inicio de Adviento', date: formatISO(boundaries.adventStart) },
      { label: 'Inicio de Navidad', date: formatISO(boundaries.christmasStart) },
      { label: 'Fin de Navidad (enero)', date: formatISO(boundaries.baptismOfLord) },
    ],
    [boundaries],
  );

  const importantDays = useMemo(() => {
    const daySet = new Set(milestones.map((m) => m.date));
    return allDays.filter((day) => {
      if (daySet.has(day.date)) return true;
      return strictImportantOnly ? isStrictOfficialTitle(day.title) : isImportantTitle(day.title);
    });
  }, [allDays, milestones, strictImportantOnly]);

  const importantByMonth = useMemo(() => {
    const map = new Map<string, CalendarDay[]>();
    importantDays.forEach((day) => {
      const month = Number(day.date.slice(5, 7));
      const key = MONTHS[month - 1];
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(day);
    });
    return Array.from(map.entries()).map(([month, days]) => ({ month, days }));
  }, [importantDays]);

  const circularSize = Math.max(250, Math.min(width - 32, height * 0.50));
  const cx = circularSize / 2;
  const cy = circularSize / 2;
  const seasonExpand = 18;
  const maxRadius = circularSize / 2 - 8;
  const seasonOuter = maxRadius - seasonExpand;
  const seasonInner = seasonOuter - Math.max(22, circularSize * 0.08);
  const zoomDayOuter = seasonInner - 8;
  const zoomDayInner = Math.max(zoomDayOuter - Math.max(34, circularSize * 0.1), 44);

  const seasonSpans = useMemo(() => {
    const spans: Array<{
      season: SeasonName;
      startIndex: number;
      endIndex: number;
      path: string;
      expandedPath: string;
    }> = [];

    if (!circularDays.length) return spans;

    let currentSeason: SeasonName = circularDays[0].season;
    let startIndex = 0;
    const total = circularDays.length;

    const pushSpan = (season: SeasonName, startIdx: number, endIdx: number) => {
      const start = (startIdx / total) * Math.PI * 2 - Math.PI / 2;
      const end = ((endIdx + 1) / total) * Math.PI * 2 - Math.PI / 2;
      spans.push({
        season,
        startIndex: startIdx,
        endIndex: endIdx,
        path: ringPath(cx, cy, seasonInner, seasonOuter, start, end),
        expandedPath: ringPath(cx, cy, seasonInner, seasonOuter + 24, start, end),
      });
    };

    for (let index = 1; index < circularDays.length; index += 1) {
      const day = circularDays[index];
      if (day.season !== currentSeason) {
        pushSpan(currentSeason, startIndex, index - 1);
        currentSeason = day.season;
        startIndex = index;
      }
    }

    pushSpan(currentSeason, startIndex, circularDays.length - 1);

    return spans;
  }, [circularDays, cx, cy, seasonInner, seasonOuter]);

  const filteredSeasonDays = useMemo(() => {
    if (!activeSeason) return [] as CalendarDay[];
    let seasonDays = circularDays.filter((day) => day.season === activeSeason);

    if (seasonMonthFilter !== 'all') {
      seasonDays = seasonDays.filter((day) => {
        const month = Number(day.date.slice(5, 7));
        return month === seasonMonthFilter;
      });
    }
    if (seasonDayFilter !== 'all') {
      seasonDays = seasonDays.filter((day) => {
        const dayNum = Number(day.date.slice(8, 10));
        return dayNum === seasonDayFilter;
      });
    }

    return seasonDays;
  }, [activeSeason, circularDays, seasonMonthFilter, seasonDayFilter]);

  useEffect(() => {
    setSeasonListLimit(10);
  }, [activeSeason, seasonMonthFilter, seasonDayFilter]);

  const seasonZoomDays = useMemo(() => {
    if (!activeSeason) return [] as Array<CalendarDay & { path: string }>;
    const seasonDays = filteredSeasonDays;

    const total = seasonDays.length || 1;

    return seasonDays.map((day, index) => {
      const start = (index / total) * Math.PI * 2 - Math.PI / 2;
      const end = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2;
      return {
        ...day,
        path: ringPath(cx, cy, zoomDayInner, zoomDayOuter, start, end),
      };
    });
  }, [activeSeason, filteredSeasonDays, cx, cy, zoomDayInner, zoomDayOuter]);
  const seasonMonthOptions = useMemo(() => {
    if (!activeSeason) return [] as number[];
    const months = new Set<number>();
    circularDays.forEach((day) => {
      if (day.season === activeSeason) months.add(Number(day.date.slice(5, 7)));
    });
    return Array.from(months.values()).sort((a, b) => a - b);
  }, [activeSeason, circularDays]);

  const seasonDayOptions = useMemo(() => {
    if (!activeSeason) return [] as number[];
    const baseDays = circularDays.filter((day) => day.season === activeSeason);
    const monthFiltered =
      seasonMonthFilter === 'all'
        ? baseDays
        : baseDays.filter((day) => Number(day.date.slice(5, 7)) === seasonMonthFilter);

    const daySet = new Set<number>();
    monthFiltered.forEach((day) => daySet.add(Number(day.date.slice(8, 10))));
    return Array.from(daySet.values()).sort((a, b) => a - b);
  }, [activeSeason, circularDays, seasonMonthFilter]);

  const monthsGrid = useMemo(() => {
    return MONTHS.map((monthLabel, monthIndex) => {
      const firstDay = utcDate(YEAR, monthIndex, 1);
      const nextMonth = monthIndex === 11 ? utcDate(YEAR + 1, 0, 1) : utcDate(YEAR, monthIndex + 1, 1);
      const totalDays = Math.round((nextMonth.getTime() - firstDay.getTime()) / (24 * 3600 * 1000));

      const jsWeekDay = firstDay.getUTCDay();
      const mondayIndex = jsWeekDay === 0 ? 6 : jsWeekDay - 1;

      const cells: Array<CalendarDay | null> = [];
      for (let i = 0; i < mondayIndex; i += 1) cells.push(null);
      for (let d = 1; d <= totalDays; d += 1) {
        const iso = formatISO(utcDate(YEAR, monthIndex, d));
        cells.push(dayMap.get(iso) || null);
      }
      while (cells.length % 7 !== 0) cells.push(null);

      return { monthLabel, cells };
    });
  }, [dayMap]);

  const themed = {
    bg: Colors[colorScheme].background,
    surface: Colors[colorScheme].surface,
    text: Colors[colorScheme].text,
    muted: Colors[colorScheme].muted,
    border: Colors[colorScheme].border,
    tint: Colors[colorScheme].tint,
  };

  const handleSeasonToggle = (season: SeasonName) => {
    setActiveSeason((prev) => {
      const next = prev === season ? null : season;
      setSeasonMonthFilter('all');
      setSeasonDayFilter('all');
      if (next) {
        const firstDay = circularDays.find((day) => day.season === next);
        if (firstDay) setSelectedDate(firstDay.date);
      }
      return next;
    });
  };

  const renderMilestones = () => (
    <View style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
      <Text style={styles.blockTitle}>Días importantes 2026</Text>
      <View style={styles.listCol}>
        {milestones.map((milestone) => (
          <Pressable key={milestone.label} onPress={() => setSelectedDate(milestone.date)}>
            <View style={styles.listRow}>
              <Text style={[styles.bullet, { color: themed.tint }]}>•</Text>
              <Text style={[styles.listText, { color: themed.text }]}>
                {milestone.label}: <Text style={[styles.listTextStrong, { color: themed.text }]}>{formatPrettyDate(milestone.date)}</Text>
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSelectedPanel = () => (
    <View style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
      <View style={[styles.evangelioHeader, { borderColor: themed.border }]}> 
        <Text style={styles.blockTitle}>{selectedDay.title}</Text>
        <Text style={[styles.meta, { color: themed.muted }]}>
          {formatPrettyDate(selectedDay.date)} · Día {selectedDay.dayOfYear} de 365
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.colorDot, { backgroundColor: SEASON_COLORS[selectedDay.season] }]} />
          <Text style={[styles.meta, { color: themed.text }]}>{selectedDay.season}</Text>
        </View>
      </View>

      <View style={[styles.evangelioBodyCard, { borderColor: themed.border }]}> 
        <Text style={[styles.meta, { color: themed.muted }]}>Evangelio</Text>
        <Text style={styles.reference}>{selectedDay.evangelioReference}</Text>
        <ScrollView style={styles.evangelioScroll} nestedScrollEnabled>
          {selectedDay.evangelioVerses.length ? (
            <View style={styles.versesWrap}>
              {selectedDay.evangelioVerses.map((verse, index) => (
                <View key={`${selectedDay.date}-verse-${index}`} style={styles.verseRow}>
                  <Text style={[styles.verseNumber, { color: themed.tint }]}>{verse.number || '•'}</Text>
                  <Text style={[styles.verseText, { color: themed.text }]}>{verse.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.bodyText, { color: themed.text }]}>
              {selectedDay.evangelioText}
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themed.bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Calendario</Text>
            <Text style={[styles.headerSubtitle, { color: themed.muted }]}>Días importantes, circular litúrgico y calendario completo</Text>
            <View style={[styles.segment, { backgroundColor: themed.surface, borderColor: themed.border }]}>
              {([
                { key: 'important', label: 'Importantes' },
                { key: 'circular', label: 'Circular' },
                { key: 'calendar', label: 'Mensual' },
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
                          colorScheme === 'dark' ? 'rgba(226, 200, 160, 0.2)' : 'rgba(177, 136, 74, 0.18)',
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Text style={[styles.segmentText, { color: selected ? themed.text : themed.muted }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Image source={HINRY_CADENA} style={styles.headerMascot} resizeMode="contain" />
        </View>

        {mode === 'important' ? (
          <>
            {renderMilestones()}
            <View style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
              <Text style={styles.blockTitle}>Criterio de selección</Text>
              <View style={styles.segment}>
                <Pressable
                  onPress={() => setStrictImportantOnly(false)}
                  style={({ pressed }) => [
                    styles.segmentButton,
                    !strictImportantOnly && {
                      backgroundColor:
                        colorScheme === 'dark' ? 'rgba(226, 200, 160, 0.2)' : 'rgba(177, 136, 74, 0.18)',
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.segmentText, { color: !strictImportantOnly ? themed.text : themed.muted }]}>
                    Amplio
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setStrictImportantOnly(true)}
                  style={({ pressed }) => [
                    styles.segmentButton,
                    strictImportantOnly && {
                      backgroundColor:
                        colorScheme === 'dark' ? 'rgba(226, 200, 160, 0.2)' : 'rgba(177, 136, 74, 0.18)',
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.segmentText, { color: strictImportantOnly ? themed.text : themed.muted }]}>
                    Estricto
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.meta, { color: themed.muted }]}>Estricto: muestra solo solemnidades, fiestas y memorias oficiales.</Text>
            </View>
            {importantByMonth.map((section) => (
              <View key={`important-${section.month}`} style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
                <Text style={styles.blockTitle}>{section.month}</Text>
                <View style={styles.listCol}>
                  {section.days.map((day) => (
                    <Pressable key={day.date} onPress={() => setSelectedDate(day.date)}>
                      <View style={[styles.row, styles.rowSeparated, { borderBottomColor: themed.border }]}>
                        <Text style={[styles.dayNumber, { color: themed.tint }]}>{Number(day.date.slice(8, 10))}</Text>
                        <View style={styles.rowText}>
                          <Text style={[styles.date, { color: themed.muted }]}>{day.date_display.toUpperCase()}</Text>
                          <Text style={styles.title}>{day.title}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {renderSelectedPanel()}
          </>
        ) : null}

        {mode === 'circular' ? (
          <>
            <View style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
              <Text style={styles.blockTitle}>Calendario litúrgico circular</Text>
              <Text style={[styles.meta, { color: themed.muted }]}>Primero toca una temporada grande para expandir sus días. En modo expandido puedes seleccionar cada día con claridad.</Text>

              <View style={styles.seasonFiltersTop}>
                {(Object.keys(SEASON_COLORS) as SeasonName[]).map((season) => {
                  const active = activeSeason === season;
                  return (
                    <Pressable key={`top-${season}`} onPress={() => handleSeasonToggle(season)}>
                      <View style={[styles.legendItem, active && { borderColor: SEASON_COLORS[season] }]}>
                        <View style={[styles.legendDot, { backgroundColor: SEASON_COLORS[season] }]} />
                        <Text style={[styles.legendText, { color: themed.text }]}>{season}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {activeSeason ? (
                <View style={styles.filterWrap}>
                  <View style={styles.filterRow}>
                    <Text style={[styles.filterLabel, { color: themed.muted }]}>Mes:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.filterChipRow}>
                        <Pressable onPress={() => { setSeasonMonthFilter('all'); setSeasonDayFilter('all'); }}>
                          <View style={[styles.filterChip, seasonMonthFilter === 'all' && { borderColor: themed.tint }]}> 
                            <Text style={[styles.filterChipText, { color: themed.text }]}>Todos</Text>
                          </View>
                        </Pressable>
                        {seasonMonthOptions.map((month) => (
                          <Pressable key={`season-month-${month}`} onPress={() => { setSeasonMonthFilter(month); setSeasonDayFilter('all'); }}>
                            <View style={[styles.filterChip, seasonMonthFilter === month && { borderColor: themed.tint }]}> 
                              <Text style={[styles.filterChipText, { color: themed.text }]}>{MONTHS[month - 1]}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  <View style={styles.filterRow}>
                    <Text style={[styles.filterLabel, { color: themed.muted }]}>Día:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.filterChipRow}>
                        <Pressable onPress={() => setSeasonDayFilter('all')}>
                          <View style={[styles.filterChip, seasonDayFilter === 'all' && { borderColor: themed.tint }]}> 
                            <Text style={[styles.filterChipText, { color: themed.text }]}>Todos</Text>
                          </View>
                        </Pressable>
                        {seasonDayOptions.map((dayNum) => (
                          <Pressable key={`season-day-${dayNum}`} onPress={() => setSeasonDayFilter(dayNum)}>
                            <View style={[styles.filterChip, seasonDayFilter === dayNum && { borderColor: themed.tint }]}> 
                              <Text style={[styles.filterChipText, { color: themed.text }]}>{dayNum}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ) : null}

              <View style={styles.circularWrap}>
                <Svg width={circularSize} height={circularSize}>
                  <G>
                    {seasonSpans.map((span) => {
                      const active = activeSeason === span.season;
                      return (
                        <Path
                          key={`${span.season}-${span.startIndex}`}
                          d={active ? span.expandedPath : span.path}
                          fill={SEASON_COLORS[span.season]}
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth={1}
                          opacity={activeSeason && !active ? 0.35 : 0.95}
                          onPress={() => handleSeasonToggle(span.season)}
                        />
                      );
                    })}

                    {seasonZoomDays.map((day) => {
                      const selected = day.date === selectedDate;
                      return (
                        <Path
                          key={day.date}
                          d={day.path}
                          fill={SEASON_COLORS[day.season]}
                          stroke={selected ? '#FFFFFF' : 'rgba(5,8,14,0.52)'}
                          strokeWidth={selected ? 1.8 : 0.8}
                          opacity={1}
                          onPress={() => setSelectedDate(day.date)}
                        />
                      );
                    })}
                  </G>
                </Svg>
              </View>

              <Text style={[styles.meta, { color: themed.muted }]}>Días visibles en el círculo: {circularDays.length} (solo fechas con datos del calendario litúrgico en el JSON)</Text>

              <View style={[styles.block, { backgroundColor: 'transparent', borderColor: themed.border }]}> 
                <Text style={styles.blockTitle}>Evangelios de la temporada</Text>
                {activeSeason ? (
                  <View style={styles.listCol}>
                    {filteredSeasonDays.slice(0, seasonListLimit).map((day) => (
                      <Pressable key={`ev-${day.date}`} onPress={() => setSelectedDate(day.date)}>
                        <View style={[styles.row, styles.rowSeparated, { borderBottomColor: themed.border }]}>
                          <Text style={[styles.dayNumber, { color: themed.tint }]}>{Number(day.date.slice(8, 10))}</Text>
                          <View style={styles.rowText}>
                            <Text style={[styles.date, { color: themed.muted }]}>{day.date_display.toUpperCase()}</Text>
                            <Text style={styles.title}>{day.evangelioReference}</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}

                    {filteredSeasonDays.length > seasonListLimit ? (
                      <Pressable onPress={() => setSeasonListLimit((prev) => prev + 10)}>
                        <View style={[styles.moreButton, { borderColor: themed.tint }]}> 
                          <Text style={[styles.moreButtonText, { color: themed.tint }]}>Ver más</Text>
                        </View>
                      </Pressable>
                    ) : null}

                    {filteredSeasonDays.length > 10 && seasonListLimit > 10 ? (
                      <Pressable onPress={() => setSeasonListLimit(10)}>
                        <View style={[styles.moreButton, { borderColor: themed.border }]}> 
                          <Text style={[styles.moreButtonText, { color: themed.muted }]}>Ver menos</Text>
                        </View>
                      </Pressable>
                    ) : null}

                    <Text style={[styles.meta, { color: themed.muted }]}>Mostrando {Math.min(seasonListLimit, filteredSeasonDays.length)} de {filteredSeasonDays.length} días</Text>
                  </View>
                ) : (
                  <Text style={[styles.meta, { color: themed.muted }]}>Selecciona una temporada arriba para ver sus evangelios.</Text>
                )}
              </View>
            </View>
            {renderSelectedPanel()}
          </>
        ) : null}

        {mode === 'calendar' ? (
          <>
            {renderMilestones()}
            {monthsGrid.map((month) => (
              <View key={month.monthLabel} style={[styles.block, { backgroundColor: themed.surface, borderColor: themed.border }]}> 
                <Text style={styles.blockTitle}>{month.monthLabel}</Text>
                <View style={styles.weekHeaderRow}>
                  {WEEKDAYS.map((week) => (
                    <Text key={`${month.monthLabel}-${week}`} style={[styles.weekHeader, { color: themed.muted }]}>{week}</Text>
                  ))}
                </View>
                <View style={styles.monthGrid}>
                  {month.cells.map((cell, index) => {
                    if (!cell) return <View key={`${month.monthLabel}-blank-${index}`} style={styles.dayCellBlank} />;
                    const selected = cell.date === selectedDate;
                    return (
                      <Pressable key={cell.date} onPress={() => setSelectedDate(cell.date)}>
                        <View
                          style={[
                            styles.dayCell,
                            {
                              borderColor: selected ? themed.tint : themed.border,
                              backgroundColor: selected
                                ? colorScheme === 'dark'
                                  ? 'rgba(226, 200, 160, 0.2)'
                                  : 'rgba(177, 136, 74, 0.16)'
                                : 'transparent',
                            },
                          ]}>
                          <Text style={[styles.dayCellNumber, { color: themed.text }]}>{Number(cell.date.slice(8, 10))}</Text>
                          <View style={[styles.dayCellDot, { backgroundColor: SEASON_COLORS[cell.season] }]} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {renderSelectedPanel()}
          </>
        ) : null}
      </ScrollView>
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
  block: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  blockTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.bodyLarge,
  },
  listCol: {
    gap: Spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  bullet: {
    fontFamily: 'SourceSans3_700Bold',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  listText: {
    flex: 1,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  listTextStrong: {
    fontFamily: 'SourceSans3_700Bold',
  },
  meta: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  evangelioHeader: {
    borderBottomWidth: 1,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  evangelioBodyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  evangelioScroll: {
    maxHeight: 320,
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  reference: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.body,
  },
  bodyText: {
    fontFamily: 'Lora_400Regular',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  versesWrap: {
    gap: Spacing.sm,
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  verseNumber: {
    minWidth: 20,
    textAlign: 'right',
    fontFamily: 'SourceSans3_700Bold',
    fontSize: TypeScale.caption,
    lineHeight: LineHeight.body,
  },
  verseText: {
    flex: 1,
    fontFamily: 'Lora_400Regular',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'flex-start',
  },
  rowSeparated: {
    borderBottomWidth: 1,
    paddingBottom: Spacing.md,
  },
  moreButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  moreButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
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
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: 'Lora_500Medium',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  circularWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    minHeight: 280,
  },
  seasonFiltersTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterWrap: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  filterRow: {
    gap: 4,
  },
  filterLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterChipText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  legendText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  weekHeaderRow: {
    flexDirection: 'row',
  },
  weekHeader: {
    width: 42,
    textAlign: 'center',
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    marginBottom: Spacing.xs,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayCellBlank: {
    width: 42,
    height: 42,
  },
  dayCell: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCellNumber: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 13,
  },
  dayCellDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});
