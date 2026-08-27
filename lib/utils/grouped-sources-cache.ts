/**
 * Grouped Sources Cache
 * Stores groupedSources data in sessionStorage to avoid extremely long URLs
 * that cause HTTP 414 errors on CDNs (e.g., Cloudflare, AWS CloudFront).
 *
 * Instead of passing the full JSON array in the URL parameter,
 * we store it in sessionStorage and pass a short key in the URL.
 */

const CACHE_PREFIX = 'gs:';
const MAX_CACHE_SIZE = 100;

/**
 * Store grouped sources data and return a short cache key.
 */
export function storeGroupedSources(data: any[]): string {
  if (typeof window === 'undefined') return '';

  const payload = JSON.stringify(data);

  try {
    // Reuse the key of an identical entry instead of minting a new one.
    // Callers re-store the same source list on every source switch / episode
    // click; without this the cache fills with duplicates of one list, hits
    // MAX_CACHE_SIZE, and evicts keys that live URLs still point at.
    const existingKey = findKeyByPayload(payload);
    if (existingKey) {
      // Refresh the timestamp so an actively used entry is never the oldest.
      sessionStorage.setItem(
        `${CACHE_PREFIX}${existingKey}`,
        JSON.stringify({ data, ts: Date.now() })
      );
      return existingKey;
    }
  } catch {
    // Fall through and store under a fresh key.
  }

  const key = generateKey();
  try {
    // Cleanup old entries if too many. Never evict the key we are about to
    // write, nor the one the current URL is using.
    cleanupOldEntries(currentGsKey());
    sessionStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // sessionStorage full or unavailable — fall back gracefully
  }
  return key;
}

/**
 * Find an existing cache key whose stored data is identical to `payload`.
 */
function findKeyByPayload(payload: string): string | null {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || '');
      if (JSON.stringify(parsed?.data) === payload) {
        return key.slice(CACHE_PREFIX.length);
      }
    } catch {
      // Skip unparseable entries.
    }
  }
  return null;
}

/**
 * The gs key referenced by the URL right now, which must survive eviction.
 */
function currentGsKey(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('gs');
  } catch {
    return null;
  }
}

/**
 * Retrieve grouped sources data by cache key.
 */
export function retrieveGroupedSources(key: string): any[] | null {
  if (typeof window === 'undefined' || !key) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch {
    return null;
  }
}

/**
 * Generate a short random key (8 chars, base36).
 */
function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Remove oldest entries when cache exceeds max size.
 * `protectedKey` is never evicted — it is the key the current URL points at,
 * and dropping it would leave that page unable to resolve its own sources.
 */
function cleanupOldEntries(protectedKey?: string | null): void {
  try {
    const protectedFull = protectedKey ? `${CACHE_PREFIX}${protectedKey}` : null;
    const entries: { key: string; ts: number }[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const raw = sessionStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          entries.push({ key, ts: parsed?.ts || 0 });
        } catch {
          entries.push({ key, ts: 0 });
        }
      }
    }

    if (entries.length >= MAX_CACHE_SIZE) {
      // Sort by timestamp ascending and remove oldest half
      entries.sort((a, b) => a.ts - b.ts);
      const toRemove = entries
        .slice(0, Math.floor(entries.length / 2))
        .filter((entry) => entry.key !== protectedFull);
      for (const entry of toRemove) {
        sessionStorage.removeItem(entry.key);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
