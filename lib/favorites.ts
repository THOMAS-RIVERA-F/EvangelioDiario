import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IsoDate } from '@/types/liturgia';

export type FavoriteKind = 'reading' | 'verse';

export type FavoritePlaylist = {
  id: string;
  name: string;
  created_at: string;
};

export type FavoriteItem = {
  id: string;
  content_id: string;
  playlist_id: string;
  kind: FavoriteKind;
  date: IsoDate;
  date_display: string;
  reading_type: string;
  reference: string;
  verse_number?: string;
  text?: string;
  created_at: string;
};

export type FavoriteDraft = {
  content_id: string;
  kind: FavoriteKind;
  date: IsoDate;
  date_display: string;
  reading_type: string;
  reference: string;
  verse_number?: string;
  text?: string;
};

type FavoritesState = {
  playlists: FavoritePlaylist[];
  items: FavoriteItem[];
};

const STORAGE_KEY = 'hinry:favorites:v2';
const LEGACY_STORAGE_KEY = 'hinry:favorites:v1';
const DEFAULT_PLAYLIST_ID = 'playlist_default';
const DEFAULT_PLAYLIST_NAME = 'Favoritos';

function nowIso() {
  return new Date().toISOString();
}

function buildDefaultPlaylist(): FavoritePlaylist {
  return {
    id: DEFAULT_PLAYLIST_ID,
    name: DEFAULT_PLAYLIST_NAME,
    created_at: nowIso(),
  };
}

function sanitizePlaylistName(name: string) {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 42);
}

function normalizeFavoriteItem(item: Partial<FavoriteItem>): FavoriteItem | null {
  if (!item) return null;
  const contentId = String(item.content_id || item.id || '').trim();
  if (!contentId) return null;

  const createdAt = String(item.created_at || nowIso());
  const playlistId = String(item.playlist_id || DEFAULT_PLAYLIST_ID);

  return {
    id: String(item.id || `${playlistId}::${contentId}`),
    content_id: contentId,
    playlist_id: playlistId,
    kind: (item.kind as FavoriteKind) || 'verse',
    date: item.date as IsoDate,
    date_display: String(item.date_display || ''),
    reading_type: String(item.reading_type || ''),
    reference: String(item.reference || ''),
    verse_number: item.verse_number ? String(item.verse_number) : undefined,
    text: item.text ? String(item.text) : undefined,
    created_at: createdAt,
  };
}

function normalizeState(input: Partial<FavoritesState> | null | undefined): FavoritesState {
  const rawPlaylists = Array.isArray(input?.playlists) ? input.playlists : [];
  const rawItems = Array.isArray(input?.items) ? input.items : [];

  const playlists = rawPlaylists
    .map((playlist) => {
      const name = sanitizePlaylistName(playlist?.name || '');
      if (!name) return null;
      return {
        id: String(playlist.id || `playlist_${Date.now()}`),
        name,
        created_at: String(playlist.created_at || nowIso()),
      } satisfies FavoritePlaylist;
    })
    .filter((playlist): playlist is FavoritePlaylist => !!playlist);

  const withDefault = playlists.some((playlist) => playlist.id === DEFAULT_PLAYLIST_ID)
    ? playlists
    : [buildDefaultPlaylist(), ...playlists];

  const playlistSet = new Set(withDefault.map((playlist) => playlist.id));

  const items = rawItems
    .map((item) => normalizeFavoriteItem(item))
    .filter((item): item is FavoriteItem => !!item)
    .map((item) =>
      playlistSet.has(item.playlist_id)
        ? item
        : {
            ...item,
            playlist_id: DEFAULT_PLAYLIST_ID,
            id: `${DEFAULT_PLAYLIST_ID}::${item.content_id}`,
          },
    );

  return {
    playlists: withDefault,
    items,
  };
}

async function persistState(state: FavoritesState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function readLegacyItems(): Promise<FavoriteItem[]> {
  const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return [];

  try {
    const parsed = JSON.parse(legacy) as Partial<FavoriteItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        normalizeFavoriteItem({
          ...item,
          content_id: String(item?.id || ''),
          playlist_id: DEFAULT_PLAYLIST_ID,
        }),
      )
      .filter((item): item is FavoriteItem => !!item);
  } catch {
    return [];
  }
}

export async function getFavoritesState(): Promise<FavoritesState> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return normalizeState(JSON.parse(stored) as FavoritesState);
    } catch {
      return normalizeState(null);
    }
  }

  const legacyItems = await readLegacyItems();
  const migrated = normalizeState({
    playlists: [buildDefaultPlaylist()],
    items: legacyItems,
  });
  await persistState(migrated);
  return migrated;
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  const state = await getFavoritesState();
  return state.items;
}

export async function getPlaylists(): Promise<FavoritePlaylist[]> {
  const state = await getFavoritesState();
  return state.playlists;
}

export async function createPlaylist(name: string): Promise<FavoritesState> {
  const normalizedName = sanitizePlaylistName(name);
  if (!normalizedName) {
    return getFavoritesState();
  }

  const state = await getFavoritesState();
  const exists = state.playlists.some(
    (playlist) => playlist.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (exists) {
    return state;
  }

  const nextState: FavoritesState = {
    ...state,
    playlists: [
      ...state.playlists,
      {
        id: `playlist_${Date.now()}`,
        name: normalizedName,
        created_at: nowIso(),
      },
    ],
  };
  await persistState(nextState);
  return nextState;
}

export async function removeFavorite(id: string): Promise<FavoriteItem[]> {
  const state = await getFavoritesState();
  const next = state.items.filter((item) => item.id !== id);
  await persistState({ ...state, items: next });
  return next;
}

export async function removeFavoriteByContentId(contentId: string): Promise<FavoriteItem[]> {
  const state = await getFavoritesState();
  const next = state.items.filter((item) => item.content_id !== contentId);
  await persistState({ ...state, items: next });
  return next;
}

export async function saveFavoriteToPlaylist(
  draft: FavoriteDraft,
  playlistId: string,
): Promise<FavoriteItem[]> {
  const state = await getFavoritesState();
  const targetPlaylist = state.playlists.find((playlist) => playlist.id === playlistId);
  const selectedPlaylistId = targetPlaylist ? playlistId : DEFAULT_PLAYLIST_ID;

  const cleaned = normalizeFavoriteItem({
    id: `${selectedPlaylistId}::${draft.content_id}`,
    content_id: draft.content_id,
    playlist_id: selectedPlaylistId,
    kind: draft.kind,
    date: draft.date,
    date_display: draft.date_display,
    reading_type: draft.reading_type,
    reference: draft.reference,
    verse_number: draft.verse_number,
    text: draft.text,
    created_at: nowIso(),
  });

  if (!cleaned) return state.items;

  const withoutSameContent = state.items.filter((item) => item.content_id !== cleaned.content_id);
  const next = [cleaned, ...withoutSameContent];
  await persistState({ ...state, items: next });
  return next;
}

export function toFavoriteMap(items: FavoriteItem[]) {
  return items.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.content_id || item.id] = true;
    return acc;
  }, {});
}
