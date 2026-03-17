import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import type { FavoriteItem } from '@/lib/favorites';
import type { FavoritePlaylist } from '@/lib/favorites';
import { createPlaylist, getFavoritesState, removeFavorite } from '@/lib/favorites';

const HINRY_ALABANDO = require('@/assets/mascot/hinry_alabando.png');

export default function FavoritesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [playlists, setPlaylists] = useState<FavoritePlaylist[]>([]);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [readingTypeFilter, setReadingTypeFilter] = useState<string>('all');

  const load = useCallback(() => {
    getFavoritesState().then((state) => {
      setItems(state.items);
      setPlaylists(state.playlists);
      setExpandedPlaylists((prev) => {
        const next = { ...prev };
        state.playlists.forEach((playlist) => {
          if (next[playlist.id] === undefined) {
            next[playlist.id] = true;
          }
        });
        return next;
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRemove = useCallback(async (id: string) => {
    const next = await removeFavorite(id);
    setItems(next);
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    const state = await createPlaylist(newPlaylistName);
    setPlaylists(state.playlists);
    setItems(state.items);
    setNewPlaylistName('');
  }, [newPlaylistName]);

  const grouped = useMemo(
    () =>
      playlists.map((playlist) => ({
        playlist,
        items: items.filter((item) => item.playlist_id === playlist.id && item.kind === 'verse'),
      })),
    [items, playlists],
  );

  const fullReadings = useMemo(
    () =>
      items
        .filter((item) => item.kind === 'reading')
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [items],
  );

  const readingTypeOptions = useMemo(() => {
    const values = new Set<string>();
    fullReadings.forEach((item) => values.add(item.reading_type || 'Lectura'));
    return ['all', ...Array.from(values)];
  }, [fullReadings]);

  const filteredFullReadings = useMemo(() => {
    if (readingTypeFilter === 'all') return fullReadings;
    return fullReadings.filter((item) => (item.reading_type || 'Lectura') === readingTypeFilter);
  }, [fullReadings, readingTypeFilter]);

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
          Organiza tus citas y lecturas favoritas
        </Text>

        <View style={styles.createRow}>
          <TextInput
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            placeholder="Crear playlist de citas (ej. Citas de fe)"
            placeholderTextColor={Colors[colorScheme].muted}
            style={[
              styles.input,
              {
                color: Colors[colorScheme].text,
                backgroundColor: Colors[colorScheme].surface,
                borderColor: Colors[colorScheme].border,
              },
            ]}
          />
          <Pressable
            onPress={handleCreatePlaylist}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: Colors[colorScheme].tint,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text style={styles.addButtonText}>Crear</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Image source={HINRY_ALABANDO} style={styles.emptyMascot} resizeMode="contain" />
            <Text style={[styles.emptyText, { color: Colors[colorScheme].muted }]}> 
              Aun no tienes favoritos guardados.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}> 
          <View style={styles.sectionHeaderRow}>
            <FontAwesome name="quote-left" size={16} color={Colors[colorScheme].tint} />
            <Text style={styles.sectionTitle}>Playlists de frases y citas</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}> 
            Versículos y frases breves, organizadas por playlist
          </Text>

          {grouped.map(({ playlist, items: playlistItems }) => {
          const expanded = expandedPlaylists[playlist.id] ?? true;
          return (
            <View
              key={playlist.id}
              style={[styles.playlistCard, { backgroundColor: Colors[colorScheme].surface }]}> 
              <Pressable
                onPress={() =>
                  setExpandedPlaylists((prev) => ({
                    ...prev,
                    [playlist.id]: !expanded,
                  }))
                }
                style={styles.playlistHeader}>
                <View>
                  <Text style={styles.playlistTitle}>{playlist.name}</Text>
                  <Text style={[styles.playlistCount, { color: Colors[colorScheme].muted }]}> 
                    {playlistItems.length} citas
                  </Text>
                </View>
                <FontAwesome
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors[colorScheme].muted}
                />
              </Pressable>

              {expanded ? (
                <View style={styles.quotesList}>
                  {playlistItems.length === 0 ? (
                    <Text style={[styles.emptyPlaylistText, { color: Colors[colorScheme].muted }]}> 
                      Esta playlist aun no tiene citas.
                    </Text>
                  ) : null}

                  {playlistItems.map((item) => {
                    const cardExpanded = !!expandedCards[item.id];
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() =>
                          setExpandedCards((prev) => ({
                            ...prev,
                            [item.id]: !cardExpanded,
                          }))
                        }
                        style={[
                          styles.quoteCard,
                          { backgroundColor: Colors[colorScheme].background },
                        ]}>
                        <View style={styles.quoteTop}>
                          <Text style={[styles.cardKind, { color: Colors[colorScheme].muted }]}> 
                            {item.kind === 'verse' ? 'Versiculo' : 'Lectura'}
                          </Text>
                          <Pressable
                            onPress={() => handleRemove(item.id)}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}> 
                            <FontAwesome name="times" size={14} color={Colors[colorScheme].muted} />
                          </Pressable>
                        </View>

                        <Text style={styles.cardTitle}>{item.reading_type} - {item.reference}</Text>

                        {item.text ? (
                          <Text
                            numberOfLines={cardExpanded ? undefined : 2}
                            style={[styles.cardText, { color: Colors[colorScheme].text }]}> 
                            {item.text}
                          </Text>
                        ) : null}

                        {cardExpanded ? (
                          <View style={styles.quoteMeta}>
                            {item.verse_number ? (
                              <Text style={[styles.cardVerse, { color: Colors[colorScheme].muted }]}> 
                                {`Versiculo ${item.verse_number}`}
                              </Text>
                            ) : null}
                            <Text style={[styles.cardDate, { color: Colors[colorScheme].muted }]}> 
                              {item.date_display}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
          })}
        </View>

        <View style={styles.sectionDivider} />

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors[colorScheme].surface,
              borderColor: Colors[colorScheme].border,
            },
          ]}> 
          <View style={styles.sectionHeaderRow}>
            <FontAwesome name="book" size={16} color={Colors[colorScheme].tint} />
            <Text style={styles.sectionTitle}>Lecturas completas guardadas</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: Colors[colorScheme].muted }]}> 
            Evangelios, salmos y lecturas completas que te tocaron el corazón
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}> 
            {readingTypeOptions.map((type) => {
              const selected = readingTypeFilter === type;
              const label = type === 'all' ? 'Todos' : type;
              return (
                <Pressable key={type} onPress={() => setReadingTypeFilter(type)}>
                  <View
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selected ? Colors[colorScheme].tint : Colors[colorScheme].border,
                        backgroundColor: selected ? Colors[colorScheme].background : Colors[colorScheme].surface,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: selected ? Colors[colorScheme].text : Colors[colorScheme].muted },
                      ]}>
                      {label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredFullReadings.length === 0 ? (
            <Text style={[styles.emptyPlaylistText, { color: Colors[colorScheme].muted }]}> 
              No hay lecturas guardadas para este filtro.
            </Text>
          ) : null}

          <View style={styles.quotesList}>
            {filteredFullReadings.map((item) => {
              const cardExpanded = !!expandedCards[item.id];
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    setExpandedCards((prev) => ({
                      ...prev,
                      [item.id]: !cardExpanded,
                    }))
                  }
                  style={[
                    styles.quoteCard,
                    { backgroundColor: Colors[colorScheme].background },
                  ]}>
                  <View style={styles.quoteTop}>
                    <Text style={[styles.cardKind, { color: Colors[colorScheme].muted }]}> 
                      Lectura completa
                    </Text>
                    <Pressable
                      onPress={() => handleRemove(item.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}> 
                      <FontAwesome name="times" size={14} color={Colors[colorScheme].muted} />
                    </Pressable>
                  </View>

                  <Text style={styles.cardTitle}>{item.reading_type} - {item.reference}</Text>

                  {item.text ? (
                    <Text
                      numberOfLines={cardExpanded ? undefined : 3}
                      style={[styles.cardText, { color: Colors[colorScheme].text }]}> 
                      {item.text}
                    </Text>
                  ) : null}

                  <View style={styles.quoteMeta}>
                    <Text style={[styles.cardDate, { color: Colors[colorScheme].muted }]}> 
                      {item.date_display}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
    gap: Spacing.xs,
  },
  title: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.title,
  },
  subtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  createRow: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.body,
  },
  addButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.body,
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  sectionCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.bodyLarge,
  },
  sectionSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  sectionDivider: {
    height: 10,
  },
  filterRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  filterChipText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
  },
  empty: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyMascot: {
    width: 130,
    height: 130,
    opacity: 0.9,
  },
  emptyText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.body,
  },
  playlistCard: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playlistTitle: {
    fontFamily: 'Lora_600SemiBold',
    fontSize: TypeScale.bodyLarge,
  },
  playlistCount: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  quotesList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  emptyPlaylistText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  quoteCard: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  quoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardKind: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: TypeScale.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  cardTitle: {
    fontFamily: 'Lora_500Medium',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  cardVerse: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
  cardText: {
    fontFamily: 'Lora_400Regular',
    fontSize: TypeScale.body,
    lineHeight: LineHeight.body,
  },
  quoteMeta: {
    gap: 2,
  },
  cardDate: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
});
