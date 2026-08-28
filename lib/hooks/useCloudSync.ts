import { useState, useCallback } from 'react';
import { useHistoryStore, usePremiumHistoryStore } from '@/lib/store/history-store';
import { useFavoritesStore, usePremiumFavoritesStore } from '@/lib/store/favorites-store';
import { keepRenderableFavorites, keepRenderableHistory } from '@/lib/utils/sync-records';
import { getProfileId } from '@/lib/store/auth-store';
import { encryptPayload, decryptPayload, hasSyncKey } from '@/lib/utils/sync-crypto';

export function useCloudSync(isPremium = false) {
  const [isSyncing, setIsSyncing] = useState(false);

  const historyStore = isPremium ? usePremiumHistoryStore : useHistoryStore;
  const favoritesStore = isPremium ? usePremiumFavoritesStore : useFavoritesStore;

  const pullFromCloud = useCallback(async () => {
    const profileId = getProfileId();
    if (!profileId) return;
    if (!(await hasSyncKey())) return;

    setIsSyncing(true);
    try {
      const response = await fetch('/api/user/sync');
      const result = await response.json();

      if (!result.success || !result.data) return;

      const envelope = result.data as { encrypted?: string };
      if (!envelope.encrypted) return;

      const plaintext = await decryptPayload(envelope.encrypted);
      if (!plaintext) return;

      const data = JSON.parse(plaintext) as { history?: unknown; favorites?: unknown };

      const history = keepRenderableHistory(data.history);
      const favorites = keepRenderableFavorites(data.favorites);

      if (history.length > 0) {
        // __KVDEBUG__ temporary: pull replaces the WHOLE local history.
        if (typeof window !== 'undefined') {
          const before = historyStore.getState().viewingHistory;
          console.log('[KVDEBUG cloudPull]', JSON.stringify({
            localCount: before.length,
            cloudCount: history.length,
            local: before.slice(0, 5).map((h) => `${h.videoId}/${h.source}/${h.title}`),
            cloud: (history as typeof before).slice(0, 5)
              .map((h) => `${h.videoId}/${h.source}/${h.title}`),
          }));
        }
        historyStore.getState().importHistory(history);
      }
      if (favorites.length > 0) {
        favoritesStore.getState().importFavorites(favorites);
      }
    } catch (error) {
      console.error('Failed to pull from cloud:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [historyStore, favoritesStore]);

  const pushToCloud = useCallback(async () => {
    const profileId = getProfileId();
    if (!profileId) return;
    if (!(await hasSyncKey())) return;

    setIsSyncing(true);
    try {
      const currentHistory = historyStore.getState().viewingHistory;
      const currentFavorites = favoritesStore.getState().favorites;

      const encrypted = await encryptPayload(
        JSON.stringify({ history: currentHistory, favorites: currentFavorites })
      );
      if (!encrypted) return;

      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted }),
      });
    } catch (error) {
      console.error('Failed to push to cloud:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [historyStore, favoritesStore]);

  return { pushToCloud, pullFromCloud, isSyncing };
}
