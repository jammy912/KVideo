/**
 * History State Store using Zustand
 * Manages viewing history with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoHistoryItem, Episode } from '@/lib/types';
import { clearSegmentsForUrl, clearAllCache } from '@/lib/utils/cacheManager';
import { profiledKey } from '@/lib/utils/profile-storage';
import { traditionalToSimplified } from '@/lib/utils/chinese-convert';

const MAX_HISTORY_ITEMS = 50;

interface HistoryState {
  viewingHistory: VideoHistoryItem[];
}

interface HistoryActions {
  addToHistory: (
    videoId: string | number,
    title: string,
    url: string,
    episodeIndex: number,
    source: string,
    playbackPosition: number,
    duration: number,
    poster?: string,
    episodes?: Episode[],
    metadata?: { vod_actor?: string; type_name?: string; vod_area?: string }
  ) => void;

  removeFromHistory: (showIdentifier: string) => void;
  clearHistory: () => void;
  importHistory: (history: VideoHistoryItem[]) => void;
  updateRotation: (showIdentifier: string, rotation: 0 | 90 | 180 | 270) => void;
}

interface HistoryStore extends HistoryState, HistoryActions { }

/**
 * Generate unique identifier for deduplication (source-agnostic).
 * Normalizes Traditional -> Simplified so records from sources that
 * differ only by script (e.g. webhtv's Android client vs. this app's
 * source APIs) collapse to the same identifier instead of duplicating.
 */
export function generateShowIdentifier(title: string): string {
  return `title:${traditionalToSimplified(title.toLowerCase().trim())}`;
}

/**
 * Recompute showIdentifier for every entry and merge those that collapse to
 * the same one.
 *
 * v1 -> v2: entries had no showIdentifier / one per source.
 * v2 -> v3: generateShowIdentifier gained Traditional -> Simplified
 *           normalisation, so identifiers persisted under v2 no longer match
 *           what the current code computes. Without this pass, a Traditional
 *           title stored as `title:媽咪` would never match the freshly
 *           computed `title:妈咪`.
 */
/**
 * Drop sourceMap pairings that cannot be true. A videoId is namespaced by the
 * source it came from, so if several sources map to the *same* id, at most one
 * of them is genuine — the rest were fabricated by injecting the current
 * videoId against another source's name. Keep the entry for the record's own
 * source and discard the duplicates, which otherwise make source-switching
 * open a different film under the same id.
 */
function pruneSourceMap(item: VideoHistoryItem): VideoHistoryItem {
  if (!item.sourceMap) return item;

  const byId = new Map<string, string[]>();
  for (const [src, id] of Object.entries(item.sourceMap)) {
    const key = String(id);
    byId.set(key, [...(byId.get(key) || []), src]);
  }

  const pruned: Record<string, string | number> = {};
  for (const [src, id] of Object.entries(item.sourceMap)) {
    const sharing = byId.get(String(id)) || [];
    // Unambiguous id, or the one source we know really used it.
    if (sharing.length === 1 || src === item.source) {
      pruned[src] = id;
    }
  }

  return { ...item, sourceMap: pruned };
}

function migrateHistory(history: VideoHistoryItem[]): VideoHistoryItem[] {
  const merged = new Map<string, VideoHistoryItem>();

  for (const item of history) {
    const newId = generateShowIdentifier(item.title);

    const existing = merged.get(newId);
    if (existing) {
      // Keep the more recent entry, merge sourceMap
      const isNewer = item.timestamp > existing.timestamp;
      const mergedSourceMap = {
        ...(existing.sourceMap || { [existing.source]: existing.videoId }),
        ...(item.sourceMap || { [item.source]: item.videoId }),
      };

      merged.set(newId, {
        ...(isNewer ? item : existing),
        showIdentifier: newId,
        sourceMap: mergedSourceMap,
        // Keep newer playback state
        playbackPosition: isNewer ? item.playbackPosition : existing.playbackPosition,
        duration: isNewer ? item.duration : existing.duration,
        episodeIndex: isNewer ? item.episodeIndex : existing.episodeIndex,
        url: isNewer ? item.url : existing.url,
        source: isNewer ? item.source : existing.source,
        videoId: isNewer ? item.videoId : existing.videoId,
        timestamp: Math.max(item.timestamp, existing.timestamp),
        episodes: (isNewer ? item.episodes : existing.episodes) || [],
        poster: isNewer ? (item.poster || existing.poster) : (existing.poster || item.poster),
      });
    } else {
      merged.set(newId, {
        ...item,
        showIdentifier: newId,
        sourceMap: item.sourceMap || { [item.source]: item.videoId },
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}

const createHistoryStore = (name: string) =>
  create<HistoryStore>()(
    persist(
      (set, get) => ({
        viewingHistory: [],

        addToHistory: (
          videoId,
          title,
          url,
          episodeIndex,
          source,
          playbackPosition,
          duration,
          poster,
          episodes = [],
          metadata
        ) => {
          const showIdentifier = generateShowIdentifier(title);
          const timestamp = Date.now();

          set((state) => {
            // Check if item already exists (by normalized title)
            const existingIndex = state.viewingHistory.findIndex(
              (item) => item.showIdentifier === showIdentifier
            );

            let newHistory: VideoHistoryItem[];

            if (existingIndex !== -1) {
              const existing = state.viewingHistory[existingIndex];
              // Merge sourceMap. A videoId is namespaced by its source, so a
              // single id must never be claimed by more than one source: if
              // another source is already recorded against the id we are
              // writing, that pairing was fabricated (not actually played)
              // and would make source-switching open the wrong video.
              const previousMap =
                existing.sourceMap || { [existing.source]: existing.videoId };
              const mergedSourceMap = Object.fromEntries(
                Object.entries(previousMap).filter(
                  ([src, id]) => src === source || String(id) !== String(videoId)
                )
              );
              mergedSourceMap[source] = videoId;

              // Update existing item and move to top
              const updatedItem: VideoHistoryItem = {
                ...existing,
                videoId,
                source,
                url,
                episodeIndex,
                playbackPosition,
                duration,
                timestamp,
                sourceMap: mergedSourceMap,
                episodes: episodes.length > 0 ? episodes : existing.episodes,
                poster: poster || existing.poster,
                vod_actor: metadata?.vod_actor ?? existing.vod_actor,
                type_name: metadata?.type_name ?? existing.type_name,
                vod_area: metadata?.vod_area ?? existing.vod_area,
              };

              newHistory = [
                updatedItem,
                ...state.viewingHistory.filter((_, index) => index !== existingIndex),
              ];
            } else {
              // Add new item at the top
              const newItem: VideoHistoryItem = {
                videoId,
                title,
                url,
                episodeIndex,
                source,
                timestamp,
                playbackPosition,
                duration,
                poster,
                episodes,
                showIdentifier,
                sourceMap: { [source]: videoId },
                vod_actor: metadata?.vod_actor,
                type_name: metadata?.type_name,
                vod_area: metadata?.vod_area,
              };

              newHistory = [newItem, ...state.viewingHistory];
            }

            // Limit history size
            if (newHistory.length > MAX_HISTORY_ITEMS) {
              newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
            }

            return { viewingHistory: newHistory };
          });
        },

        removeFromHistory: (showIdentifier) => {
          const state = get();
          const itemToRemove = state.viewingHistory.find(
            (item) => item.showIdentifier === showIdentifier
          );

          if (itemToRemove) {
            // Clear cache for this video
            clearSegmentsForUrl(itemToRemove.url);
          }

          set((state) => ({
            viewingHistory: state.viewingHistory.filter(
              (item) => item.showIdentifier !== showIdentifier
            ),
          }));
        },

        clearHistory: () => {
          // Clear all cached segments
          clearAllCache();
          set({ viewingHistory: [] });
        },

        importHistory: (history) => {
          set({ viewingHistory: history });
        },

        updateRotation: (showIdentifier, rotation) => {
          set((state) => ({
            viewingHistory: state.viewingHistory.map((item) =>
              item.showIdentifier === showIdentifier
                ? { ...item, rotation }
                : item
            ),
          }));
        },
      }),
      {
        name,
        version: 4,
        migrate: (persistedState: any, version: number) => {
          const oldHistory: VideoHistoryItem[] = persistedState?.viewingHistory || [];

          if (version < 3) {
            // v1 -> v2: entries lacked a showIdentifier.
            // v2 -> v3: showIdentifier is now Simplified-normalised, so the
            // persisted ones must be recomputed or they will never match.
            // migrateHistory already prunes as part of the rebuild below.
            return {
              ...persistedState,
              viewingHistory: migrateHistory(oldHistory).map(pruneSourceMap),
            };
          }

          if (version < 4) {
            // v3 -> v4: strip sourceMap entries where several sources claim
            // the same videoId — those pairings were never verified and made
            // source-switching play the wrong film.
            return {
              ...persistedState,
              viewingHistory: oldHistory.map(pruneSourceMap),
            };
          }

          return persistedState as HistoryStore;
        },
      }
    )
  );

export const useHistoryStore = createHistoryStore(profiledKey('kvideo-history-store'));
export const usePremiumHistoryStore = createHistoryStore(profiledKey('kvideo-premium-history-store'));

/**
 * Helper hook to get the appropriate history store
 */
export function useHistory(isPremium = false) {
  const normalStore = useHistoryStore();
  const premiumStore = usePremiumHistoryStore();
  return isPremium ? premiumStore : normalStore;
}
