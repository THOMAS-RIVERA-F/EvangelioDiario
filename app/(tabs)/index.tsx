import {
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
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
    reading_sets: Array<{
      readings: Array<{
        type: string;
        reference: string;
        verses: Array<{ number?: string; text: string }>;
      }>;
    }>;
  }>;
};

const lecturas = lecturasRaw as LecturasData;
const HINRY_REZANDO = require('@/assets/mascot/hinry_rezando.png');
const HERO_IMAGES = [
  require('@/assets/photos/hombre1.png'),
  require('@/assets/photos/hombre2.png'),
  require('@/assets/photos/hombre3.png'),
  require('@/assets/photos/hombre4.png'),
];

const LITURGICAL_COLORS: Record<string, string> = {
  Blanco: '#EFE6D6',
  Rojo: '#E7B0A8',
  Verde: '#BFD4B1',
  Morado: '#C3B6D6',
  Rosa: '#E7C0D2',
  Negro: '#C8C2BA',
  Dorado: '#E8D3A2',
};

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TabOneScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.72, 320);
  const cardHeight = Math.round(cardWidth * 1.25);

  const todayKey = formatLocalISO(new Date());
  const today = lecturas.days.find((day) => day.date === todayKey) ?? lecturas.days[0];
  const accent = useMemo(() => {
    if (!today?.color) return Colors[colorScheme].border;
    return LITURGICAL_COLORS[today.color] ?? Colors[colorScheme].border;
  }, [today?.color, colorScheme]);
  const readings = useMemo(() => {
    const all = today.reading_sets.flatMap((set) => set.readings);
    return [...all].sort((a, b) => {
      const aEv = a.type.toLowerCase().includes('evangelio') ? 0 : 1;
      const bEv = b.type.toLowerCase().includes('evangelio') ? 0 : 1;
      return aEv - bEv;
    });
  }, [today]);

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
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>Hinry</Text>
            <Text style={[styles.brandSubtitle, { color: Colors[colorScheme].muted }]}>
              Evangelio diario
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Link href="/(tabs)/two" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                  pressed && { opacity: 0.7 },
                ]}>
                <FontAwesome name="calendar" size={16} color={Colors[colorScheme].text} />
              </Pressable>
            </Link>
            <Link href="/(tabs)/favorites" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: Colors[colorScheme].surface,
                    borderColor: Colors[colorScheme].border,
                  },
                  pressed && { opacity: 0.7 },
                ]}>
                <FontAwesome name="bookmark" size={16} color={Colors[colorScheme].text} />
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.hinryRow}>
          <Image source={HINRY_REZANDO} style={styles.hinry} resizeMode="contain" />
        </View>

        <View style={styles.dayBlock}>
          <Text style={[styles.date, { color: Colors[colorScheme].muted }]}>
            {(today?.date_display ?? todayKey).toUpperCase()}
          </Text>
          <View style={[styles.accentLine, { backgroundColor: accent }]} />
          <Text style={styles.title}>{today?.title ?? 'Lectura del dia'}</Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={readings}
          keyExtractor={(item, index) => `${item.type}-${item.reference}-${index}`}
          contentContainerStyle={styles.carousel}
          snapToInterval={cardWidth + Spacing.md}
          decelerationRate="fast"
          renderItem={({ item, index }) => {
            const image = HERO_IMAGES[index % HERO_IMAGES.length];
            return (
              <Link href={{ pathname: '/reading', params: { index } }} asChild>
                <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
                  <View style={[styles.cardShell, { width: cardWidth, height: cardHeight }]}>
                    <View
                      style={[
                        styles.cardLayer,
                        {
                          borderColor: Colors[colorScheme].border,
                          backgroundColor: Colors[colorScheme].surface,
                        },
                      ]}
                    />
                    <ImageBackground
                      source={image}
                      style={styles.cardImage}
                      imageStyle={styles.cardImageStyle}>
                      <View style={styles.cardOverlay} />
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTag}>{item.type.toUpperCase()}</Text>
                        <Text style={styles.cardTitle}>{item.reference}</Text>
                        <View style={styles.cardFooter}>
                          <View style={[styles.cta, { backgroundColor: Colors[colorScheme].surface }]}>
                            <Text style={styles.ctaText}>Leer</Text>
                          </View>
                          <FontAwesome
                            name="arrow-right"
                            size={14}
                            color={Colors[colorScheme].surface}
                          />
                        </View>
                      </View>
                    </ImageBackground>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  brandBlock: {
    gap: Spacing.xs,
  },
  brand: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
  },
  brandSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  hinryRow: {
    alignItems: 'flex-end',
    marginTop: -Spacing.sm,
  },
  hinry: {
    width: 128,
    height: 128,
    opacity: 0.95,
  },
  dayBlock: {
    gap: Spacing.sm,
  },
  date: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.6,
  },
  accentLine: {
    height: 2,
    width: 52,
    borderRadius: 999,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  carousel: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  cardShell: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  cardLayer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: -6,
    bottom: -6,
    borderRadius: Radius.xl,
    borderWidth: 1,
    opacity: 0.7,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardImageStyle: {
    borderRadius: Radius.xl,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 22, 20, 0.22)',
  },
  cardContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardTag: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.4,
    color: '#FFFFFF',
  },
  cardTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
    lineHeight: LineHeight.title,
    color: '#FFFFFF',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  cta: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
});
