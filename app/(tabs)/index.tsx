import { Animated, Image, Pressable, StyleSheet, View as RNView } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'expo-router';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import lecturasRaw from '@/data/lecturas_2026.json';

type LecturasData = {
  days: Array<{
    date: string;
    date_display: string;
    title: string;
    color?: string;
  }>;
};

const lecturas = lecturasRaw as LecturasData;

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const LITURGICAL_COLORS: Record<string, string> = {
  Blanco: '#EFE6D6',
  Rojo: '#E7B0A8',
  Verde: '#BFD4B1',
  Morado: '#C3B6D6',
  Rosa: '#E7C0D2',
  Negro: '#C8C2BA',
  Dorado: '#E8D3A2',
};
const HINRY_REZANDO = require('@/assets/mascot/hinry_rezando.png');

export default function TabOneScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const todayKey = formatLocalISO(new Date());
  const today = lecturas.days.find((day) => day.date === todayKey) ?? lecturas.days[0];
  const accent = useMemo(() => {
    if (!today?.color) return Colors[colorScheme].border;
    return LITURGICAL_COLORS[today.color] ?? Colors[colorScheme].border;
  }, [today?.color, colorScheme]);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, lift]);

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fade,
            transform: [{ translateY: lift }],
          },
        ]}>
        <View style={styles.header}>
          <Text style={[styles.date, { color: Colors[colorScheme].muted }]}>
            {(today?.date_display ?? todayKey).toUpperCase()}
          </Text>
          <RNView style={[styles.accentLine, { backgroundColor: accent }]} />
        </View>

        <Text style={styles.title}>{today?.title ?? 'Lectura del dia'}</Text>

        <RNView style={styles.mascotWrap}>
          <Image source={HINRY_REZANDO} style={styles.mascot} resizeMode="contain" />
        </RNView>

        <Link href="/reading" asChild>
          <Pressable>
            {({ pressed }) => (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    opacity: pressed ? 0.9 : 1,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}>
                <Text style={styles.cardTitle}>Evangelio</Text>
                <Text style={[styles.cardHint, { color: Colors[colorScheme].muted }]}>
                  Lectura principal del dia
                </Text>
              </View>
            )}
          </Pressable>
        </Link>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  accentLine: {
    height: 2,
    width: 44,
    borderRadius: 999,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  date: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.6,
  },
  card: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
  },
  cardTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
    marginBottom: Spacing.xs,
  },
  cardHint: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  mascotWrap: {
    alignSelf: 'flex-start',
  },
  mascot: {
    width: 96,
    height: 96,
    opacity: 0.9,
  },
});
