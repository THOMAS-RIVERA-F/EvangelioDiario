import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import ViewShot from 'react-native-view-shot';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HinryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const flipValuesRef = useRef<Record<string, Animated.Value>>({});
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingDate, setPlayingDate] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const cardShotRefs = useRef<Record<string, ViewShot | null>>({});
  const cardAnimRef = useRef<
    Record<string, { fade: Animated.Value; lift: Animated.Value; started: boolean }>
  >({});
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
    const cards = [todayDay, yesterdayDay].filter(Boolean) as HinryDay[];
    cards.forEach((day, index) => {
      const anim = getCardAnim(day.date);
      if (anim.started) return;
      anim.started = true;
      Animated.parallel([
        Animated.timing(anim.fade, {
          toValue: 1,
          duration: 520,
          delay: 140 + index * 140,
          useNativeDriver: true,
        }),
        Animated.timing(anim.lift, {
          toValue: 0,
          duration: 520,
          delay: 140 + index * 140,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [todayDay, yesterdayDay, getCardAnim]);

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
    const shot = cardShotRefs.current[day.date];
    if (shot?.capture) {
      try {
        const uri = await shot.capture();
        await Share.share({
          title: 'Hoy con Hinry',
          message,
          url: uri,
        });
        return;
      } catch {
        // fallback to text-only share
      }
    }
    await Share.share({
      title: 'Hoy con Hinry',
      message,
    });
  }, []);

  const handleSave = useCallback(async (day: HinryDay) => {
    setSavedMap((prev) => {
      const next = { ...prev, [day.date]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handlePlay = useCallback(
    async (day: HinryDay) => {
      const source = AUDIO_HINRY[day.date];
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

  const getCardAnim = useCallback((key: string) => {
    if (!cardAnimRef.current[key]) {
      cardAnimRef.current[key] = {
        fade: new Animated.Value(0),
        lift: new Animated.Value(16),
        started: false,
      };
    }
    return cardAnimRef.current[key];
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

  return (
    <View style={[styles.container, { backgroundColor: themed.background }]}>
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

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.cardsColumn}>
          {[todayDay, yesterdayDay].map((day, index) => {
            if (!day) return null;
            const cardAnim = getCardAnim(day.date);

            const isSaved = !!savedMap[day.date];
            const hinryText = buildHinryText(day);
            const isToday = index === 0;
            const label = 'Hoy con Hinry';
            const mascot = isToday ? HINRY_HOY : HINRY_AYER;
            const cardBack = isToday ? CARD_BACK_HOY : CARD_BACK_AYER;
            const liturgicalTitle = titleMap[day.date] ?? day.title ?? label;
            const hasAudio = !!AUDIO_HINRY[day.date];
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
                style={{ opacity: cardAnim.fade, transform: [{ translateY: cardAnim.lift }] }}>
                <View style={styles.cardShell}>
                  <View style={styles.cardGlow} />
                  <View style={styles.cardFlipStage}>
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
                        collapsable={false}
                        style={styles.cardShot}>
                        <View
                          style={[
                            styles.card,
                            { backgroundColor: themed.surface },
                          ]}>
                          <View style={styles.cardTop}>
                            <View style={styles.cardTopText}>
                              <Text style={styles.cardDate}>{day.date}</Text>
                              <Text style={styles.cardLabel}>{liturgicalTitle}</Text>
                              <Text style={[styles.cardTag, { color: themed.muted }]}>{label}</Text>
                            </View>
                            <Image
                              source={mascot}
                              style={styles.cardMascot}
                              resizeMode="contain"
                            />
                          </View>

                          <Text style={[styles.cardText, { color: themed.text }]}>{hinryText}</Text>

                          <Pressable
                            onPress={() => handlePlay(day)}
                            disabled={!hasAudio}
                            style={({ pressed }) => [
                              styles.audioShell,
                              {
                                backgroundColor: hasAudio
                                  ? 'rgba(0, 0, 0, 0.12)'
                                  : 'rgba(0, 0, 0, 0.06)',
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}>
                            <View
                              style={[
                                styles.audioButton,
                                { backgroundColor: themed.tint },
                              ]}>
                              <FontAwesome
                                name={isPlaying ? 'pause' : 'play'}
                                size={12}
                                color="#FFFFFF"
                              />
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
                                        backgroundColor: active
                                          ? themed.tint
                                          : 'rgba(0,0,0,0.25)',
                                      },
                                    ]}
                                  />
                                );
                              })}
                            </View>
                            <Text style={[styles.audioLabel, { color: themed.muted }]}>
                              {hasAudio ? (isPlaying ? 'Reproduciendo' : 'Escuchar audio') : 'Audio no disponible'}
                            </Text>
                          </Pressable>

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
                              <Text style={[styles.flipButtonText, { color: themed.tint }]}>
                                Girar
                              </Text>
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
                {isToday && yesterdayDay ? (
                  <View style={styles.cardTransition}>
                    <View style={styles.cardTransitionLine} />
                    <Text style={[styles.cardTransitionText, { color: themed.muted }]}>AYER</Text>
                    <View style={styles.cardTransitionLine} />
                  </View>
                ) : null}
              </Animated.View>
            );
          })}
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
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
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
    fontSize: 28,
  },
  headerSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  headerMascot: {
    width: 120,
    height: 120,
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
    gap: Spacing.lg,
  },
  cardsColumn: {
    flex: 1,
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
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(154, 108, 58, 0.18)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cardTag: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.2,
  },
  cardMascot: {
    width: 124,
    height: 124,
    opacity: 0.95,
  },
  cardText: {
    fontFamily: 'Lora_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  cardShot: {
    borderRadius: Radius.xl,
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
    minHeight: 380,
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
