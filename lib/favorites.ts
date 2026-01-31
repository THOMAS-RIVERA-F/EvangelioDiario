import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IsoDate } from '@/types/liturgia';

export type FavoriteKind = 'reading' | 'verse';

export type FavoriteItem = {
  id: string;
  kind: FavoriteKind;
  date: IsoDate;
  date_display: string;
  reading_type: string;
  reference: string;
  verse_number?: string;
  text?: string;
  created_at: string;
};

const STORAGE_KEY = 'hinry:favorites:v1';

export async function getFavorites(): Promise<FavoriteItem[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as FavoriteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveFavorite(item: FavoriteItem): Promise<FavoriteItem[]> {
  const items = await getFavorites();
  if (items.some((existing) => existing.id === item.id)) {
    return items;
  }
  const next = [item, ...items];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeFavorite(id: string): Promise<FavoriteItem[]> {
  const items = await getFavorites();
  const next = items.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function toggleFavorite(item: FavoriteItem): Promise<FavoriteItem[]> {
  const items = await getFavorites();
  const exists = items.some((existing) => existing.id === item.id);
  const next = exists ? items.filter((existing) => existing.id !== item.id) : [item, ...items];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function toFavoriteMap(items: FavoriteItem[]) {
  return items.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.id] = true;
    return acc;
  }, {});
}
