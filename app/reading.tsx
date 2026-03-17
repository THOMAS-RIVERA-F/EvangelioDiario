import {
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import lecturasRaw from '@/data/lecturas_2026.json';
import type { LiturgicalCalendar, Reading } from '@/types/liturgia';
import { useThemePreference } from '@/components/ThemeContext';
import {
  createPlaylist,
  getFavoritesState,
  removeFavoriteByContentId,
  saveFavoriteToPlaylist,
  toFavoriteMap,
  type FavoriteDraft,
  type FavoritePlaylist,
} from '@/lib/favorites';

const lecturas = lecturasRaw as LiturgicalCalendar;
const HERO_IMAGES = [
  require('@/assets/photos/hombre1.png'),
  require('@/assets/photos/hombre2.png'),
];
const HINRY_BIBLIA = require('@/assets/mascot/hinry_con_biblia.png');

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string; date?: string; reference?: string; verse?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const { preference, setPreference } = useThemePreference();
  const todayKey = formatLocalISO(new Date());
  const currentDate = params.date && params.date.length === 10 ? params.date : todayKey;
  const today = lecturas.days.find((day) => day.date === currentDate) ?? lecturas.days.find((day) => day.date === todayKey) ?? lecturas.days[0];
  const readings = useMemo(
    () => today.reading_sets.flatMap((set) => set.readings),
    [today]
  );

  const maxIndex = Math.max(0, readings.length - 1);
  const initialIndex = useMemo(() => {
    const byReference = params.reference
      ? readings.findIndex((reading) => {
          const a = String(reading.reference || '').toLowerCase().trim();
          const b = String(params.reference || '').toLowerCase().trim();
          return a === b || a.includes(b) || b.includes(a);
        })
      : -1;
    if (byReference >= 0) return byReference;
    return Math.min(maxIndex, Math.max(0, Number(params.index ?? 0) || 0));
  }, [maxIndex, params.index, params.reference, readings]);
  const listRef = useRef<FlatList<Reading>>(null);
  const [fontSize, setFontSize] = useState(18);
  const lineHeight = useMemo(() => Math.round(fontSize * 1.72), [fontSize]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const themeAccent =
    colorScheme === 'dark' ? 'rgba(226, 200, 160, 0.2)' : 'rgba(154, 108, 58, 0.16)';
  const verseHighlight =
    colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});
  const [playlists, setPlaylists] = useState<FavoritePlaylist[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<FavoriteDraft | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const loadFavorites = useCallback(() => {
    getFavoritesState().then((state) => {
      setFavoriteMap(toFavoriteMap(state.items));
      setPlaylists(state.playlists);
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

  useEffect(() => {
    if (!listRef.current || initialIndex === 0) return;
    const handle = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 50);
    return () => clearTimeout(handle);
  }, [initialIndex]);

  useEffect(() => {
    setActiveIndex(initialIndex);
    setSelectedVerseId(null);
    if (!listRef.current) return;
    const handle = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 30);
    return () => clearTimeout(handle);
  }, [initialIndex, today.date]);

  useEffect(() => {
    if (!params.verse) return;
    const reading = readings[activeIndex];
    if (!reading) return;

    const verseIndex = reading.verses.findIndex(
      (verse, idx) => String(verse.number ?? idx) === String(params.verse),
    );
    if (verseIndex < 0) return;

    const verse = reading.verses[verseIndex];
    const readingId = `${today.date}-${reading.type}-${reading.reference}`;
    const verseId = `${readingId}-v-${verse.number ?? verseIndex}`;
    setSelectedVerseId(verseId);
  }, [activeIndex, params.verse, readings, today.date]);

  const closePlaylistPicker = useCallback(() => {
    setPickerVisible(false);
    setPendingFavorite(null);
    setNewPlaylistName('');
  }, []);

  const handleSaveInPlaylist = useCallback(
    async (playlistId: string) => {
      if (!pendingFavorite) return;
      const next = await saveFavoriteToPlaylist(pendingFavorite, playlistId);
      setFavoriteMap(toFavoriteMap(next));
      closePlaylistPicker();
    },
    [closePlaylistPicker, pendingFavorite],
  );

  const handleCreatePlaylist = useCallback(async () => {
    const state = await createPlaylist(newPlaylistName);
    setPlaylists(state.playlists);
    setNewPlaylistName('');
  }, [newPlaylistName]);

  const handleToggle = useCallback(async (item: FavoriteDraft) => {
    const exists = !!favoriteMap[item.content_id];

    if (exists) {
      const next = await removeFavoriteByContentId(item.content_id);
      setFavoriteMap(toFavoriteMap(next));
      return;
    }

    setPendingFavorite(item);
    setPickerVisible(true);
  }, [favoriteMap]);

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
          ref={listRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={readings as Reading[]}
          keyExtractor={(item, index) => `${item.type}-${item.reference}-${index}`}
          contentContainerStyle={styles.horizontalList}
          snapToInterval={width}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
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
            const fullReadingText = item.verses
              .map((verse) => `${verse.number ? `${verse.number} ` : ''}${verse.text}`.trim())
              .join('\n');
            const readingFavorite: FavoriteDraft = {
              content_id: readingId,
              kind: 'reading',
              date: today.date,
              date_display: today.date_display,
              reading_type: item.type,
              reference: item.reference,
              text: fullReadingText,
            };
            const isReadingFavorited = !!favoriteMap[readingId];
            const favoriteIconColor = isReadingFavorited
              ? Colors[colorScheme].tint
              : Colors[colorScheme].muted;
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.985, 1, 0.985],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.7, 1, 0.7],
              extrapolate: 'clamp',
            });
            const heroImage = HERO_IMAGES[index % HERO_IMAGES.length];

            return (
              <Animated.View style={{ width, opacity, transform: [{ scale }] }}>
                <ScrollView
                  contentContainerStyle={styles.readingContent}
                  showsVerticalScrollIndicator={false}>
                  <ImageBackground
                    source={heroImage}
                    style={styles.hero}
                    imageStyle={styles.heroImage}>
                    <View style={styles.heroOverlay} />
                    <View style={styles.heroTop}>
                      <Pressable
                        onPress={() => router.back()}
                        style={({ pressed }) => [
                          styles.backButton,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}>
                        <FontAwesome name="arrow-left" size={14} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggle(readingFavorite)}
                        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                        <FontAwesome
                          name={isReadingFavorited ? 'bookmark' : 'bookmark-o'}
                          size={18}
                          color="#FFFFFF"
                        />
                      </Pressable>
                    </View>
                    <View style={styles.heroContent}>
                      <Text style={styles.heroTag}>{item.type.toUpperCase()}</Text>
                      <Text style={styles.heroTitle}>{item.reference}</Text>
                    </View>
                  </ImageBackground>

                  <View
                    style={[styles.readingBox, { backgroundColor: Colors[colorScheme].surface }]}>
                    {item.verses.map((verse, verseIndex) => {
                      const verseId = `${readingId}-v-${verse.number ?? verseIndex}`;
                      const verseFavorite: FavoriteDraft = {
                        content_id: verseId,
                        kind: 'verse',
                        date: today.date,
                        date_display: today.date_display,
                        reading_type: item.type,
                        reference: item.reference,
                        verse_number: verse.number,
                        text: verse.text,
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

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closePlaylistPicker}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              },
            ]}>
            <Text style={styles.modalTitle}>Guardar en playlist</Text>
            <Text style={[styles.modalSubtitle, { color: Colors[colorScheme].muted }]}>
              Elige una colección para esta frase.
            </Text>

            <View style={styles.modalList}>
              {playlists.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  onPress={() => handleSaveInPlaylist(playlist.id)}
                  style={({ pressed }) => [
                    styles.modalPlaylist,
                    {
                      backgroundColor: Colors[colorScheme].background,
                      borderColor: Colors[colorScheme].border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <Text style={styles.modalPlaylistText}>{playlist.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalCreateRow}>
              <TextInput
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="Nueva playlist"
                placeholderTextColor={Colors[colorScheme].muted}
                style={[
                  styles.modalInput,
                  {
                    color: Colors[colorScheme].text,
                    backgroundColor: Colors[colorScheme].background,
                    borderColor: Colors[colorScheme].border,
                  },
                ]}
              />
              <Pressable
                onPress={handleCreatePlaylist}
                style={({ pressed }) => [
                  styles.modalAdd,
                  {
                    backgroundColor: Colors[colorScheme].tint,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={styles.modalAddText}>Crear</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={closePlaylistPicker}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.modalCancel, { color: Colors[colorScheme].muted }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
  horizontalList: {
    paddingBottom: Spacing.lg,
  },
  readingContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  hero: {
    height: 240,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroImage: {
    borderRadius: Radius.xl,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 9, 8, 0.28)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroContent: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  heroTag: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    letterSpacing: 1.4,
    color: '#FFFFFF',
  },
  heroTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
    lineHeight: LineHeight.title,
    color: '#FFFFFF',
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
    width: 120,
    height: 120,
    opacity: 0.92,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.bodyLarge,
  },
  modalSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  modalList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  modalPlaylist: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modalPlaylistText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.body,
  },
  modalCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.body,
  },
  modalAdd: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modalAddText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.body,
    color: '#FFFFFF',
  },
  modalCancel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.body,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
  },
});
