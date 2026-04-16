import { useState, useCallback } from 'react';
import { useHistoryStore, usePremiumHistoryStore } from '@/lib/store/history-store';
import { useFavoritesStore, usePremiumFavoritesStore } from '@/lib/store/favorites-store';
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

      if (Array.isArray(data.history) && data.history.length > 0) {
        historyStore.getState().importHistory(data.history as Parameters<ReturnType<typeof historyStore.getState>['importHistory']>[0]);
      }
      if (Array.isArray(data.favorites) && data.favorites.length > 0) {
        favoritesStore.getState().importFavorites(data.favorites as Parameters<ReturnType<typeof favoritesStore.getState>['importFavorites']>[0]);
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
