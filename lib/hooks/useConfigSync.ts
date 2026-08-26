/**
 * useConfigSync - Syncs user settings to the server for cross-device
 * and PWA persistence. Pulls on mount, pushes on change.
 *
 * End-to-end encrypted: payload is AES-GCM encrypted with a key derived
 * from the user's password (PBKDF2). Server stores ciphertext only.
 */

import { useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import { getProfileId } from '@/lib/store/auth-store';
import { encryptPayload, decryptPayload, hasSyncKey } from '@/lib/utils/sync-crypto';

const DEBOUNCE_MS = 3000;

interface SyncPayload {
  sources?: unknown;
  premiumSources?: unknown;
  subscriptions?: unknown;
  blockedCategories?: unknown;
  sortBy?: unknown;
  locale?: unknown;
  userSources?: unknown;
  danmakuApis?: unknown;
  activeDanmakuApiId?: unknown;
}

async function pushNow(): Promise<void> {
  if (!getProfileId()) return;
  if (!(await hasSyncKey())) return;

  try {
    const settings = settingsStore.getSettings();
    const userState = userSourcesStore.getState();
    const payload: SyncPayload = {
      sources: settings.sources,
      premiumSources: settings.premiumSources,
      subscriptions: settings.subscriptions,
      blockedCategories: settings.blockedCategories,
      sortBy: settings.sortBy,
      locale: settings.locale,
      userSources: userState.sources,
      danmakuApis: userState.danmakuApis,
      activeDanmakuApiId: userState.activeDanmakuApiId,
    };

    const encrypted = await encryptPayload(JSON.stringify(payload));
    if (!encrypted) return;

    await fetch('/api/user/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted }),
    });

    const stored = localStorage.getItem('kvideo-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed._syncedAt = Date.now();
      localStorage.setItem('kvideo-settings', JSON.stringify(parsed));
    }
  } catch {
    // Silently fail — local storage is the primary source
  }
}

// Module-level reference so non-hook callers (e.g. settings import) can flush.
let flushPushRef: (() => Promise<void>) | null = null;

export async function flushConfigSync(): Promise<void> {
  if (flushPushRef) {
    await flushPushRef();
  }
}

export function useConfigSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPulled = useRef(false);

  const hasSession = useCallback(() => {
    return !!getProfileId();
  }, []);

  // Pull config from server on mount (once)
  useEffect(() => {
    if (hasPulled.current) return;
    hasPulled.current = true;

    const pull = async () => {
      if (!hasSession()) return;
      if (!(await hasSyncKey())) return;

      try {
        const res = await fetch('/api/user/config');
        const result = await res.json();

        if (!result.success || !result.data) return;

        const envelope = result.data as { encrypted?: string; updatedAt?: number };
        if (!envelope.encrypted) return;

        const plaintext = await decryptPayload(envelope.encrypted);
        if (!plaintext) return;

        const serverData: SyncPayload = JSON.parse(plaintext);
        const local = settingsStore.getSettings();

        const serverTime = envelope.updatedAt || 0;
        const localStr = localStorage.getItem('kvideo-settings');
        const localTime = localStr
          ? JSON.parse(localStr)?._syncedAt || 0
          : 0;

        if (serverTime > localTime) {
          const merged = { ...local };

          if (Array.isArray(serverData.sources) && serverData.sources.length > 0) {
            merged.sources = serverData.sources as typeof local.sources;
          }
          if (Array.isArray(serverData.premiumSources) && serverData.premiumSources.length > 0) {
            merged.premiumSources = serverData.premiumSources as typeof local.premiumSources;
          }
          if (Array.isArray(serverData.subscriptions) && serverData.subscriptions.length > 0) {
            merged.subscriptions = serverData.subscriptions as typeof local.subscriptions;
          }
          if (serverData.blockedCategories) {
            merged.blockedCategories = serverData.blockedCategories as typeof local.blockedCategories;
          }

          settingsStore.saveSettings(merged);

          const userPatch: Parameters<typeof userSourcesStore.setState>[0] = {};
          if (Array.isArray(serverData.userSources)) {
            userPatch.sources = serverData.userSources as ReturnType<typeof userSourcesStore.getSources>;
          }
          if (Array.isArray(serverData.danmakuApis)) {
            userPatch.danmakuApis = serverData.danmakuApis as ReturnType<typeof userSourcesStore.getDanmakuApis>;
          }
          if (typeof serverData.activeDanmakuApiId === 'string' || serverData.activeDanmakuApiId === null) {
            userPatch.activeDanmakuApiId = serverData.activeDanmakuApiId;
          }
          if (Object.keys(userPatch).length > 0) {
            userSourcesStore.setState(userPatch);
          }

          const stored = localStorage.getItem('kvideo-settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed._syncedAt = serverTime;
            localStorage.setItem('kvideo-settings', JSON.stringify(parsed));
          }
        }
      } catch {
        // Server unavailable or decrypt failed — keep local settings
      }
    };

    pull();
  }, [hasSession]);

  // Push config to server on settings change (debounced)
  useEffect(() => {
    const push = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void pushNow();
      }, DEBOUNCE_MS);
    };

    flushPushRef = async () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      await pushNow();
    };

    const unsubSettings = settingsStore.subscribe(push);
    const unsubUserSources = userSourcesStore.subscribe(push);
    return () => {
      unsubSettings();
      unsubUserSources();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      flushPushRef = null;
    };
  }, [hasSession]);
}
