import { Animated, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import ViewShot from 'react-native-view-shot';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import hinryRaw from '@/data/hinry_master_2026.json';
import lecturasRaw from '@/data/lecturas_2026.json';
import type { LiturgicalCalendar } from '@/types/liturgia';

type HinryDay = {
  date: string;
  title?: string;
  hinry: {
    contexto: string[];
    explicacion: string[];
    mensaje_central: string;
    agradecimiento: string[];
    cierre: string;
    text?: string;
  };
};

const HINRY_RIGHT = require('@/assets/mascot/hinry-predicando-sentado-izq.png');
const HINRY_HOY = require('@/assets/mascot/hinry-hoy.png');
const HINRY_AYER = require('@/assets/mascot/hinry-ayer.png');
const CARD_BACK_HOY = require('@/assets/photos/carta-atras-hoy.png');
const CARD_BACK_AYER = require('@/assets/photos/carta-atras-ayer.png');
const AUDIO_HINRY: Record<string, number> = {
  '2026-02-03': require('@/assets/audio/hinry_2026-02-03.mp3'),
};
const AUDIO_HOY_DEFAULT = require('@/assets/audio/hinry_hoy.mp3');
const AUDIO_AYER_DEFAULT = require('@/assets/audio/hinry_ayer.mp3');
const WAVE_BARS = [4, 10, 6, 14, 8, 18, 12, 7, 16, 9, 15, 6, 13, 8, 17, 10, 5, 12];
const STORAGE_KEY = 'hinry_downloaded_days_v1';
const hinryDays = (hinryRaw as { days: HinryDay[] }).days;
const lecturas = lecturasRaw as LiturgicalCalendar;

function buildHinryText(day: HinryDay) {
  if (day.hinry.text) return day.hinry.text;
  const lines = [
    day.hinry.contexto?.join(' '),
    day.hinry.explicacion?.join(' '),
    day.hinry.mensaje_central,
    day.hinry.agradecimiento?.length ? `Gracias por: ${day.hinry.agradecimiento.join(', ')}.` : '',
    day.hinry.cierre,
  ];
  return lines.filter(Boolean).join('\n\n');
}

function extractKeyQuotes(day: HinryDay) {
  const rawParts = [
    ...(day.hinry.contexto ?? []),
    ...(day.hinry.explicacion ?? []),
    day.hinry.mensaje_central,
    day.hinry.text,
  ]
    .filter(Boolean)
    .join(' ');

  const matches = [...rawParts.matchAll(/["“]([^"”]+)["”]\s*\(([^)]+)\)/g)];
  const unique = new Set<string>();
  const quotes: string[] = [];

  matches.forEach((match) => {
    const phrase = (match[1] ?? '').trim();
    const reference = (match[2] ?? '').trim();
    if (!phrase || !reference) return;
    const formatted = `“${phrase}” (${reference})`;
    if (unique.has(formatted)) return;
    unique.add(formatted);
    quotes.push(formatted);
  });

  return quotes.slice(0, 2);
}

function normalizeRef(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCitationData(quote: string) {
  const citationMatch = quote.match(/\(([^)]+)\)\s*$/);
  if (!citationMatch) return null;

  const citation = citationMatch[1].trim();
  const passage = citation.split(',')[0]?.trim() || citation;
  const verseNumber = citation.match(/\bv\.?\s*(\d+)\b/i)?.[1];

  return { citation, passage, verseNumber };
}

function buildStructuredContent(day: HinryDay) {
  const formatSpanishLongDate = (isoDate: string) => {
    const date = new Date(`${isoDate}T12:00:00`);
    const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    const weekday = weekdays[date.getDay()] ?? '';
    const dayNumber = date.getDate();
    const month = months[date.getMonth()] ?? '';
    return `${weekday} ${dayNumber} de ${month}`;
  };

  const cleanReflectionText = (value: string, keyQuotes: string[]) => {
    let text = value;

    keyQuotes.forEach((quote) => {
      const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(escaped, 'g'), '');
    });

    text = text
      .replace(/["“][^"”]+["”]\s*\([^)]+\)/g, '')
      .replace(/^(cuando escuchamos|al oír|esta frase|con esta frase|con)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  };

  const context = (day.hinry.contexto ?? []).filter(Boolean).join(' ');
  const quotes = extractKeyQuotes(day);

  const reflectionRaw = [
    ...(day.hinry.explicacion ?? []),
    day.hinry.mensaje_central,
  ]
    .filter(Boolean)
    .join(' ');

  const reflection = cleanReflectionText(reflectionRaw, quotes) || reflectionRaw;

  const invitationItems = (day.hinry.agradecimiento ?? []).filter((line) => {
    if (!line) return false;
    if (/\d{4}-\d{2}-\d{2}/.test(line)) return false;
    return true;
  });

  const niceDate = formatSpanishLongDate(day.date);
  const invitationIntro = `Para ${niceDate}, vive esta palabra con alegría y valentía:`;

  return {
    context,
    quotes,
    reflection,
    invitationIntro,
    invitationItems,
  };
}

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveAudioSource(date: string) {
  return AUDIO_HINRY[date] ?? null;
}

export default function HinryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { height: screenH, width: screenW } = useWindowDimensions();
  const cardHeight = useMemo(() => Math.max(560, Math.round(screenH * 0.76)), [screenH]);

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const flipValuesRef = useRef<Record<string, Animated.Value>>({});
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingDate, setPlayingDate] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const cardShotRefs = useRef<Record<string, ViewShot | null>>({});
    const shareViewRefs = useRef<Record<string, ViewShot | null>>({});
  const progressTickRef = useRef<Record<string, number>>({});
  const didInitFlipRef = useRef(false);

  const todayKey = useMemo(() => formatLocalISO(new Date()), []);
  const yesterdayKey = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatLocalISO(date);
  }, []);

  const todayDay = useMemo(
    () => hinryDays.find((day) => day.date === todayKey),
    [todayKey]
  );
  const yesterdayDay = useMemo(
    () => hinryDays.find((day) => day.date === yesterdayKey),
    [yesterdayKey]
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]).start();
  }, [fade, lift]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setSavedMap(parsed);
      } catch {
        setSavedMap({});
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const handleShare = useCallback(async (day: HinryDay) => {
    const message = buildHinryText(day);
    const shot = shareViewRefs.current[day.date];
    if (shot?.capture) {
      try {
        const uri = await shot.capture();
        await Share.share({ title: 'Hoy con Hinry', message, url: uri });
        return;
      } catch {
        // fallback to text-only share
      }
    }
    await Share.share({ title: 'Hoy con Hinry', message });
  }, []);

  const handleSave = useCallback(async (day: HinryDay) => {
    setSavedMap((prev) => {
      const next = { ...prev, [day.date]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handlePlay = useCallback(
    async (day: HinryDay, isTodayCard: boolean) => {
      const source = resolveAudioSource(day.date);
      if (!source) return;

      if (playingDate === day.date && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingDate(null);
        setProgressMap((prev) => ({ ...prev, [day.date]: 0 }));
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      setPlayingDate(day.date);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.durationMillis) {
          const progress = Math.min(1, status.positionMillis / status.durationMillis);
          const now = Date.now();
          const last = progressTickRef.current[day.date] ?? 0;
          if (now - last > 160) {
            progressTickRef.current[day.date] = now;
            setProgressMap((prev) => ({ ...prev, [day.date]: progress }));
          }
        }
        if (status.didJustFinish) {
          setPlayingDate(null);
          setProgressMap((prev) => ({ ...prev, [day.date]: 0 }));
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    },
    [playingDate]
  );

  const getFlipValue = useCallback((key: string) => {
    if (!flipValuesRef.current[key]) {
      flipValuesRef.current[key] = new Animated.Value(0);
    }
    return flipValuesRef.current[key];
  }, []);

  const handleFlip = useCallback(
    (day: HinryDay) => {
      setFlippedMap((prev) => {
        const nextFlipped = !prev[day.date];
        const anim = getFlipValue(day.date);
        Animated.timing(anim, {
          toValue: nextFlipped ? 180 : 0,
          duration: 520,
          useNativeDriver: true,
        }).start();
        return { ...prev, [day.date]: nextFlipped };
      });
    },
    [getFlipValue]
  );

  useEffect(() => {
    if (didInitFlipRef.current) return;
    if (!todayDay && !yesterdayDay) return;

    const next: Record<string, boolean> = {};
    if (todayDay) {
      next[todayDay.date] = true;
      getFlipValue(todayDay.date).setValue(180);
    }
    if (yesterdayDay) {
      next[yesterdayDay.date] = true;
      getFlipValue(yesterdayDay.date).setValue(180);
    }
    setFlippedMap(next);
    didInitFlipRef.current = true;
  }, [todayDay, yesterdayDay, getFlipValue]);

  const themed = useMemo(
    () => ({
      surface: Colors[colorScheme].surface,
      background: Colors[colorScheme].background,
      text: Colors[colorScheme].text,
      muted: Colors[colorScheme].muted,
      tint: Colors[colorScheme].tint,
    }),
    [colorScheme]
  );

  const titleMap = useMemo(() => {
    const map: Record<string, string> = {};
    lecturas.days.forEach((day) => {
      map[day.date] = day.title;
    });
    return map;
  }, []);

  const getQuoteTarget = useCallback((date: string, quote: string) => {
    const day = lecturas.days.find((d) => d.date === date);
    if (!day) return null;

    const citation = getCitationData(quote);
    if (!citation) return null;

    const readings = day.reading_sets.flatMap((set) => set.readings);
    const targetPassage = normalizeRef(citation.passage);

    let index = readings.findIndex((reading) => normalizeRef(reading.reference) === targetPassage);

    if (index < 0) {
      index = readings.findIndex((reading) => {
        const ref = normalizeRef(reading.reference);
        return ref.includes(targetPassage) || targetPassage.includes(ref);
      });
    }

    if (index < 0) return null;

    return {
      index,
      reference: readings[index].reference,
      verseNumber: citation.verseNumber,
    };
  }, []);

  const renderShareSnapshot = (day: HinryDay, isToday: boolean) => {
    const { context, quotes, reflection, invitationIntro, invitationItems } = buildStructuredContent(day);
    const label = isToday ? 'Hoy' : 'Ayer';
    const mascot = isToday ? HINRY_HOY : HINRY_AYER;
    const liturgicalTitle = titleMap[day.date] ?? day.title ?? label;
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -(screenW + 400), top: 0 }}>
        <ViewShot
          ref={(ref) => { shareViewRefs.current[day.date] = ref; }}
          options={{ format: 'png', quality: 0.95 }}>
          <View
            collapsable={false}
            style={[styles.shareCard, { backgroundColor: themed.surface, width: screenW - Spacing.lg * 2 }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardTopText}>
                <Text style={styles.cardDate}>{day.date}</Text>
                <Text style={styles.cardLabel}>{liturgicalTitle}</Text>
                <View style={styles.cardBadge}>
                  <Text style={[styles.cardBadgeText, { color: themed.tint }]}>{label}</Text>
                </View>
              </View>
              <Image source={mascot} style={styles.cardMascot} resizeMode="contain" />
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Contexto breve</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{context || buildHinryText(day)}</Text>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Frases clave del Evangelio</Text>
              {quotes.length ? (
                quotes.map((quote, qi) => (
                  <View key={`sq-${qi}`} style={[styles.quoteCard, { borderColor: themed.tint }]}>
                    <Text style={[styles.quoteText, { color: themed.text }]}>{quote}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.sectionParagraph, { color: themed.text }]}>{day.hinry.mensaje_central}</Text>
              )}
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Reflexión</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{reflection}</Text>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Invitación para el día</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{invitationIntro}</Text>
              <View style={styles.invitationList}>
                {invitationItems.length ? (
                  invitationItems.map((item, ii) => (
                    <View key={`si-${ii}`} style={styles.invitationRow}>
                      <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                      <Text style={[styles.invitationText, { color: themed.text }]}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.invitationRow}>
                    <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                    <Text style={[styles.invitationText, { color: themed.text }]}>{day.hinry.cierre}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.shareFooter, { borderTopColor: Colors[colorScheme].border }]}>
              <Text style={[styles.shareFooterText, { color: themed.muted }]}>Hinry · Evangelio diario</Text>
            </View>
          </View>
        </ViewShot>
      </View>
    );
  };

  const renderCard = (day: HinryDay, isToday: boolean) => {
      const renderShareSnapshot = (day: HinryDay, isToday: boolean) => {
        const { context, quotes, reflection, invitationIntro, invitationItems } = buildStructuredContent(day);
        const label = isToday ? 'Hoy' : 'Ayer';
        const mascot = isToday ? HINRY_HOY : HINRY_AYER;
        const liturgicalTitle = titleMap[day.date] ?? day.title ?? label;
        return (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: -(screenW + 400), top: 0 }}>
            <ViewShot
              ref={(ref) => { shareViewRefs.current[day.date] = ref; }}
              options={{ format: 'png', quality: 0.95 }}>
              <View
                collapsable={false}
                style={[styles.shareCard, { backgroundColor: themed.surface, width: screenW - Spacing.lg * 2 }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTopText}>
                    <Text style={styles.cardDate}>{day.date}</Text>
                    <Text style={styles.cardLabel}>{liturgicalTitle}</Text>
                    <View style={styles.cardBadge}>
                      <Text style={[styles.cardBadgeText, { color: themed.tint }]}>{label}</Text>
                    </View>
                  </View>
                  <Image source={mascot} style={styles.cardMascot} resizeMode="contain" />
                </View>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: themed.tint }]}>Contexto breve</Text>
                  <Text style={[styles.sectionParagraph, { color: themed.text }]}>{context || buildHinryText(day)}</Text>
                </View>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: themed.tint }]}>Frases clave del Evangelio</Text>
                  {quotes.length ? (
                    quotes.map((quote, qi) => (
                      <View key={`sq-${qi}`} style={[styles.quoteCard, { borderColor: themed.tint }]}>
                        <Text style={[styles.quoteText, { color: themed.text }]}>{quote}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.sectionParagraph, { color: themed.text }]}>{day.hinry.mensaje_central}</Text>
                  )}
                </View>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: themed.tint }]}>Reflexión</Text>
                  <Text style={[styles.sectionParagraph, { color: themed.text }]}>{reflection}</Text>
                </View>
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: themed.tint }]}>Invitación para el día</Text>
                  <Text style={[styles.sectionParagraph, { color: themed.text }]}>{invitationIntro}</Text>
                  <View style={styles.invitationList}>
                    {invitationItems.length ? (
                      invitationItems.map((item, ii) => (
                        <View key={`si-${ii}`} style={styles.invitationRow}>
                          <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                          <Text style={[styles.invitationText, { color: themed.text }]}>{item}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.invitationRow}>
                        <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                        <Text style={[styles.invitationText, { color: themed.text }]}>{day.hinry.cierre}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.shareFooter, { borderTopColor: Colors[colorScheme].border }]}>
                  <Text style={[styles.shareFooterText, { color: themed.muted }]}>Hinry · Evangelio diario</Text>
                </View>
              </View>
            </ViewShot>
          </View>
        );
      };

    const isSaved = !!savedMap[day.date];
    const { context, quotes, reflection, invitationIntro, invitationItems } = buildStructuredContent(day);
    const label = isToday ? 'Hoy' : 'Ayer';
    const mascot = isToday ? HINRY_HOY : HINRY_AYER;
    const cardBack = isToday ? CARD_BACK_HOY : CARD_BACK_AYER;
    const liturgicalTitle = titleMap[day.date] ?? day.title ?? label;
    const hasAudio = !!resolveAudioSource(day.date);
    const isPlaying = playingDate === day.date;
    const progress = progressMap[day.date] ?? 0;
    const isFlipped = !!flippedMap[day.date];
    const rotate = getFlipValue(day.date);

    const frontRotate = rotate.interpolate({
      inputRange: [0, 180],
      outputRange: ['0deg', '180deg'],
    });
    const backRotate = rotate.interpolate({
      inputRange: [0, 180],
      outputRange: ['180deg', '360deg'],
    });

    return (
      <Animated.View
        key={day.date}
        style={{ opacity: fade, transform: [{ translateY: lift }] }}>
        <View style={styles.cardShell}>
          <View style={styles.cardGlow} />
          <View style={[styles.cardFlipStage, { height: cardHeight }]}>
            <Animated.View
              pointerEvents={isFlipped ? 'none' : 'auto'}
              style={[
                styles.cardFace,
                { transform: [{ perspective: 900 }, { rotateY: frontRotate }] },
              ]}>
              <ViewShot
                ref={(ref) => {
                  cardShotRefs.current[day.date] = ref;
                }}
                options={{ format: 'png', quality: 0.95 }}
                style={[styles.cardShot, { height: cardHeight }]}>
                <View style={[styles.card, { backgroundColor: themed.surface }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopText}>
                      <Text style={styles.cardDate}>{day.date}</Text>
                      <Text style={styles.cardLabel}>{liturgicalTitle}</Text>
                      <View style={styles.cardBadge}>
                        <Text style={[styles.cardBadgeText, { color: themed.tint }]}>{label}</Text>
                      </View>
                    </View>
                    <Image source={mascot} style={styles.cardMascot} resizeMode="contain" />
                  </View>

                  <ScrollView
                    style={styles.cardTextScroll}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled>
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionTitle, { color: themed.tint }]}>Contexto breve</Text>
                      <Text style={[styles.sectionParagraph, { color: themed.text }]}>{context || buildHinryText(day)}</Text>
                    </View>

                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionTitle, { color: themed.tint }]}>Frases clave del Evangelio</Text>
                      {quotes.length ? (
                        quotes.map((quote, quoteIndex) => (
                          <Pressable
                            key={`${day.date}-quote-${quoteIndex}`}
                            onPress={() => {
                              const target = getQuoteTarget(day.date, quote);
                              if (!target) return;
                              router.push({
                                pathname: '/reading',
                                params: {
                                  date: day.date,
                                  index: String(target.index),
                                  reference: target.reference,
                                  verse: target.verseNumber,
                                },
                              });
                            }}
                            style={[styles.quoteCard, { borderColor: themed.tint }]}
                          >
                            <Text style={[styles.quoteText, { color: themed.text }]}>{quote}</Text>
                          </Pressable>
                        ))
                      ) : (
                        <Text style={[styles.sectionParagraph, { color: themed.text }]}>{day.hinry.mensaje_central}</Text>
                      )}
                    </View>

                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionTitle, { color: themed.tint }]}>Reflexión</Text>
                      <Text style={[styles.sectionParagraph, { color: themed.text }]}>{reflection}</Text>
                    </View>

                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionTitle, { color: themed.tint }]}>Invitación para el día</Text>
                      <Text style={[styles.sectionParagraph, { color: themed.text }]}>{invitationIntro}</Text>
                      <View style={styles.invitationList}>
                        {invitationItems.length ? (
                          invitationItems.map((item, itemIndex) => (
                            <View key={`${day.date}-invite-${itemIndex}`} style={styles.invitationRow}>
                              <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                              <Text style={[styles.invitationText, { color: themed.text }]}>{item}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={styles.invitationRow}>
                            <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                            <Text style={[styles.invitationText, { color: themed.text }]}>{day.hinry.cierre}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </ScrollView>

                  {hasAudio && <Pressable
                    onPress={() => handlePlay(day, isToday)}
                    style={({ pressed }) => [
                      styles.audioShell,
                      {
                        backgroundColor: 'rgba(0,0,0,0.12)',
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}>
                    <View style={[styles.audioButton, { backgroundColor: themed.tint }]}>
                      <FontAwesome name={isPlaying ? 'pause' : 'play'} size={12} color="#FFFFFF" />
                    </View>
                    <View style={styles.audioWave}>
                      {WAVE_BARS.map((height, barIndex) => {
                        const active = barIndex / WAVE_BARS.length <= progress;
                        return (
                          <View
                            key={`bar-${barIndex}`}
                            style={[
                              styles.audioBar,
                              {
                                height,
                                backgroundColor: active ? themed.tint : 'rgba(0,0,0,0.25)',
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                    <Text style={[styles.audioLabel, { color: themed.muted }]}>
                      {isPlaying ? 'Reproduciendo' : 'Escuchar audio'}
                    </Text>
                  </Pressable>}

                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => handleFlip(day)}
                      style={({ pressed }) => [
                        styles.flipButton,
                        {
                          borderColor: themed.tint,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text style={[styles.flipButtonText, { color: themed.tint }]}>Girar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleShare(day)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { backgroundColor: themed.tint, opacity: pressed ? 0.85 : 1 },
                      ]}>
                      <Text style={styles.actionText}>Compartir</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSave(day)}
                      style={({ pressed }) => [
                        styles.actionGhost,
                        {
                          borderColor: themed.tint,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}>
                      <Text style={[styles.actionGhostText, { color: themed.tint }]}> 
                        {isSaved ? 'Guardado' : 'Descargar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ViewShot>
            </Animated.View>

            <Animated.View
              pointerEvents={isFlipped ? 'auto' : 'none'}
              style={[
                styles.cardFace,
                styles.cardFaceBack,
                { transform: [{ perspective: 900 }, { rotateY: backRotate }] },
              ]}>
              <Pressable onPress={() => handleFlip(day)} style={styles.cardBackPress}>
                <View style={styles.cardBack}>
                  <Image source={cardBack} style={styles.cardBackImage} resizeMode="cover" />
                  <View style={styles.cardBackOverlay}>
                    <Text style={styles.cardBackHint}>Toca para girar</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themed.background }]}> 
        {todayDay ? renderShareSnapshot(todayDay, true) : null}
        {yesterdayDay ? renderShareSnapshot(yesterdayDay, false) : null}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fade,
            transform: [{ translateY: lift }],
          },
        ]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Hoy con Hinry</Text>
            <Text style={[styles.headerSubtitle, { color: themed.muted }]}> 
              Un espacio para respirar el Evangelio con calma
            </Text>
          </View>
          <Image source={HINRY_RIGHT} style={styles.headerMascot} resizeMode="contain" />
        </View>
        <View style={styles.headerStripe}>
          <View style={[styles.headerStripeFill, { backgroundColor: themed.tint }]} />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.cardsColumn}>
          {todayDay ? renderCard(todayDay, true) : null}

          {todayDay && yesterdayDay ? (
            <View style={styles.cardTransition}>
              <View style={styles.cardTransitionLine} />
              <Text style={[styles.cardTransitionText, { color: themed.muted }]}>AYER</Text>
              <View style={styles.cardTransitionLine} />
            </View>
          ) : null}

          {yesterdayDay ? renderCard(yesterdayDay, false) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: 26,
  },
  headerSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  headerMascot: {
    width: 88,
    height: 88,
  },
  headerStripe: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  headerStripeFill: {
    width: 120,
    height: '100%',
    borderRadius: 999,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  cardsColumn: {
    gap: Spacing.lg,
  },
  cardShell: {
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    top: -8,
    left: 24,
    right: 24,
    height: 70,
    borderRadius: 999,
    backgroundColor: 'rgba(222, 187, 128, 0.28)',
  },
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(154, 108, 58, 0.18)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  cardTopText: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardDate: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.5,
  },
  cardLabel: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.titleLarge,
    lineHeight: LineHeight.titleLarge,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(177, 136, 74, 0.12)',
    marginTop: 2,
  },
  cardBadgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.2,
  },
  cardMascot: {
    width: 110,
    height: 110,
    opacity: 0.95,
  },
  cardTextScroll: {
    flex: 1,
  },
  cardText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 16,
    lineHeight: 26,
  },
  sectionBlock: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'SourceSans3_700Bold',
    fontSize: TypeScale.body,
    letterSpacing: 0.2,
  },
  sectionParagraph: {
    fontFamily: 'Lora_400Regular',
    fontSize: TypeScale.body,
    lineHeight: 26,
  },
  quoteCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: 'rgba(177, 136, 74, 0.08)',
  },
  quoteText: {
    fontFamily: 'Lora_500Medium',
    fontSize: TypeScale.body,
    lineHeight: 25,
  },
  invitationList: {
    gap: Spacing.xs,
    marginTop: 2,
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  invitationBullet: {
    fontFamily: 'SourceSans3_700Bold',
    fontSize: TypeScale.body,
    lineHeight: 24,
  },
  invitationText: {
    flex: 1,
    fontFamily: 'Lora_400Regular',
    fontSize: TypeScale.body,
    lineHeight: 25,
  },
  cardShot: {
    borderRadius: Radius.xl,
  },
  shareCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(154, 108, 58, 0.18)',
  },
  shareFooter: {
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center' as const,
  },
  shareFooterText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
    letterSpacing: 0.8,
  },
  audioShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  audioButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    flex: 1,
  },
  audioBar: {
    width: 4,
    borderRadius: 999,
  },
  audioLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  cardFlipStage: {
    position: 'relative',
  },
  cardFace: {
    backfaceVisibility: 'hidden',
  },
  cardFaceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBack: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(154, 108, 58, 0.18)',
  },
  cardBackPress: {
    flex: 1,
  },
  cardBackImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl,
  },
  cardBackOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignSelf: 'flex-start',
  },
  cardBackHint: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cardTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  cardTransitionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  cardTransitionText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  flipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  flipButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  actionButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  actionText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    color: '#FFFFFF',
  },
  actionGhost: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionGhostText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
});
