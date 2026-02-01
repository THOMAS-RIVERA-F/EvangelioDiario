import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { LineHeight, Radius, Spacing, TypeScale } from '@/constants/Design';
import { useColorScheme } from '@/components/useColorScheme';
import type { FavoriteItem } from '@/lib/favorites';
import { getFavorites, removeFavorite } from '@/lib/favorites';

const HINRY_ALABANDO = require('@/assets/mascot/hinry_alabando.png');

export default function FavoritesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [items, setItems] = useState<FavoriteItem[]>([]);

  const load = useCallback(() => {
    getFavorites().then(setItems);
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

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoritos</Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme].muted }]}>
          Lecturas y versiculos guardados
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={HINRY_ALABANDO} style={styles.emptyMascot} resizeMode="contain" />
            <Text style={[styles.emptyText, { color: Colors[colorScheme].muted }]}>
              Aun no tienes favoritos.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: Colors[colorScheme].surface }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardKind, { color: Colors[colorScheme].muted }]}>
                {item.kind === 'verse' ? 'Versiculo' : 'Lectura'}
              </Text>
              <Pressable
                onPress={() => handleRemove(item.id)}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <FontAwesome name="times" size={14} color={Colors[colorScheme].muted} />
              </Pressable>
            </View>
            <Text style={styles.cardTitle}>
              {item.reading_type} - {item.reference}
            </Text>
            {item.verse_number ? (
              <Text style={[styles.cardVerse, { color: Colors[colorScheme].muted }]}>
                {`Versiculo ${item.verse_number}`}
              </Text>
            ) : null}
            {item.text ? (
              <Text style={[styles.cardText, { color: Colors[colorScheme].text }]}>
                {item.text}
              </Text>
            ) : null}
            <Text style={[styles.cardDate, { color: Colors[colorScheme].muted }]}>
              {item.date_display}
            </Text>
          </View>
        )}
      />
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
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
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
  card: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
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
  cardDate: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
  },
});
