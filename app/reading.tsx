import {
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import lecturasRaw from '@/data/lecturas_2026.json';
import type { LiturgicalCalendar, Reading } from '@/types/liturgia';
import { useThemePreference } from '@/components/ThemeContext';
import { getFavorites, toggleFavorite, toFavoriteMap, type FavoriteItem } from '@/lib/favorites';

const lecturas = lecturasRaw as LiturgicalCalendar;
const HINRY_BIBLIA = require('@/assets/mascot/hinry_con_biblia.png');

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReadingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { preference, setPreference } = useThemePreference();
  const todayKey = formatLocalISO(new Date());
  const today = lecturas.days.find((day) => day.date === todayKey) ?? lecturas.days[0];
  const readings = useMemo(
    () => today.reading_sets.flatMap((set) => set.readings),
    [today]
  );

  const [fontSize, setFontSize] = useState(18);
  const lineHeight = useMemo(() => Math.round(fontSize * 1.72), [fontSize]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const themeAccent =
    colorScheme === 'dark' ? 'rgba(226, 200, 160, 0.2)' : 'rgba(154, 108, 58, 0.16)';
  const verseHighlight =
    colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});

  const loadFavorites = useCallback(() => {
    getFavorites().then((items) => {
      setFavoriteMap(toFavoriteMap(items));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const handleToggle = useCallback(async (item: FavoriteItem) => {
    const next = await toggleFavorite(item);
    setFavoriteMap(toFavoriteMap(next));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <Animated.View
        style={[
          styles.stage,
          {
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.controls}>
          <View
            style={[
              styles.themeSegment,
              {
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              },
            ]}>
            {([
              { key: 'system', label: 'Auto' },
              { key: 'light', label: 'Claro' },
              { key: 'dark', label: 'Noche' },
            ] as const).map((option) => {
              const selected = preference === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPreference(option.key)}
                  style={({ pressed }) => [
                    styles.themeButton,
                    selected && { backgroundColor: themeAccent },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text
                    style={[
                      styles.themeText,
                      { color: selected ? Colors[colorScheme].text : Colors[colorScheme].muted },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: Colors[colorScheme].muted }]}>
              Tamano de letra
            </Text>
            <Text style={[styles.controlCount, { color: Colors[colorScheme].muted }]}>
              {`Lectura ${Math.min(activeIndex + 1, readings.length)} de ${readings.length}`}
            </Text>
          </View>
          <View style={styles.controlRow}>
            <Pressable
              onPress={() => setFontSize((size) => Math.max(15, size - 1))}
              style={({ pressed }) => [
                styles.controlButton,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={styles.controlText}>-</Text>
            </Pressable>
            <Text style={[styles.controlValue, { color: Colors[colorScheme].muted }]}>
              {fontSize}px
            </Text>
            <Pressable
              onPress={() => setFontSize((size) => Math.min(24, size + 1))}
              style={({ pressed }) => [
                styles.controlButton,
                {
                  backgroundColor: Colors[colorScheme].surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <Text style={styles.controlText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.dots}>
            {readings.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [6, 16, 6],
                extrapolate: 'clamp',
              });
              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={`dot-${index}`}
                  style={[
                    styles.dot,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      backgroundColor: Colors[colorScheme].tint,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <Animated.FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={readings as Reading[]}
          keyExtractor={(item, index) => `${item.type}-${item.reference}-${index}`}
          contentContainerStyle={styles.horizontalList}
          snapToInterval={width}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveIndex(nextIndex);
            setSelectedVerseId(null);
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            const readingId = `${today.date}-${item.type}-${item.reference}`;
            const readingFavorite: FavoriteItem = {
              id: readingId,
              kind: 'reading',
              date: today.date,
              date_display: today.date_display,
              reading_type: item.type,
              reference: item.reference,
              text: item.verses[0]?.text,
              created_at: new Date().toISOString(),
            };
            const isReadingFavorited = !!favoriteMap[readingId];
            const favoriteIconColor = isReadingFavorited
              ? Colors[colorScheme].tint
              : Colors[colorScheme].muted;
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.98, 1, 0.98],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.65, 1, 0.65],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View style={{ width, opacity, transform: [{ scale }] }}>
                <ScrollView
                  contentContainerStyle={styles.readingContent}
                  showsVerticalScrollIndicator={false}>
                  <View style={styles.headerRow}>
                    <View style={styles.header}>
                      <Text style={[styles.type, { color: Colors[colorScheme].muted }]}>
                        {item.type}
                      </Text>
                      <Text style={styles.reference}>{item.reference}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleToggle(readingFavorite)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                      <FontAwesome
                        name={isReadingFavorited ? 'bookmark' : 'bookmark-o'}
                        size={18}
                        color={favoriteIconColor}
                      />
                    </Pressable>
                  </View>

                  <View
                    style={[styles.readingBox, { backgroundColor: Colors[colorScheme].surface }]}>
                    {item.verses.map((verse, verseIndex) => {
                      const verseId = `${readingId}-v-${verse.number ?? verseIndex}`;
                      const verseFavorite: FavoriteItem = {
                        id: verseId,
                        kind: 'verse',
                        date: today.date,
                        date_display: today.date_display,
                        reading_type: item.type,
                        reference: item.reference,
                        verse_number: verse.number,
                        text: verse.text,
                        created_at: new Date().toISOString(),
                      };
                      const isVerseFavorited = !!favoriteMap[verseId];
                      const isSelected = selectedVerseId === verseId;
                      const showVerseIcon = isVerseFavorited || isSelected;
                      const verseIconColor = isVerseFavorited
                        ? Colors[colorScheme].tint
                        : Colors[colorScheme].muted;

                      return (
                        <Pressable
                          key={`verse-${verseIndex}`}
                          onPress={() => setSelectedVerseId(verseId)}
                          onLongPress={() => handleToggle(verseFavorite)}
                          style={({ pressed }) => [
                            styles.verseRow,
                            (pressed || isSelected) && { backgroundColor: verseHighlight },
                          ]}>
                          {verse.number ? (
                            <Text style={[styles.verseNumber, { color: Colors[colorScheme].muted }]}>
                              {verse.number}
                            </Text>
                          ) : null}
                          <Text style={[styles.verseText, { fontSize, lineHeight }]}>
                            {verse.text}
                          </Text>
                          {showVerseIcon ? (
                            <Pressable
                              onPress={() => handleToggle(verseFavorite)}
                              style={({ pressed }) => [
                                styles.verseAction,
                                { opacity: pressed ? 0.6 : 1 },
                              ]}>
                              <FontAwesome
                                name={isVerseFavorited ? 'bookmark' : 'bookmark-o'}
                                size={14}
                                color={verseIconColor}
                              />
                            </Pressable>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.mascotClosing}>
                    <Image source={HINRY_BIBLIA} style={styles.mascot} resizeMode="contain" />
                  </View>
                </ScrollView>
              </Animated.View>
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
  stage: {
    flex: 1,
  },
  header: {
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  type: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  reference: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
    lineHeight: LineHeight.title,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  themeSegment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  themeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  themeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  controlCount: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 16,
  },
  controlValue: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  horizontalList: {
    paddingBottom: Spacing.xl,
  },
  readingContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  readingBox: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  verseRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    borderRadius: Radius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  verseNumber: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    marginTop: 4,
  },
  verseText: {
    flex: 1,
    fontFamily: 'Lora_400Regular',
  },
  verseAction: {
    paddingTop: 4,
    paddingLeft: 4,
  },
  mascotClosing: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  mascot: {
    width: 88,
    height: 88,
    opacity: 0.85,
  },
});
