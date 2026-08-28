/**
 * __KVDEBUG__ TEMPORARY — remove once the watch-history overwrite bug is fixed.
 *
 * next.config.ts sets `compiler.removeConsole` for production builds, so any
 * console.* call is stripped out of the deployed bundle and diagnostics on the
 * live site produce nothing. This records events into a global ring buffer
 * (mirrored into sessionStorage so they survive navigation) instead.
 *
 * To read them in the browser:
 *   copy(__kvDump())      // full JSON to clipboard
 *   __kvDump()            // returns the array
 *   __kvClear()           // reset
 */

const MAX_EVENTS = 400;
const STORAGE_KEY = 'kvdebug-events';

interface KvDebugEvent {
  t: number;
  tag: string;
  data: unknown;
}

declare global {
  interface Window {
    __kvEvents?: KvDebugEvent[];
    __kvDump?: () => string;
    __kvClear?: () => void;
  }
}

function load(): KvDebugEvent[] {
  if (window.__kvEvents) return window.__kvEvents;
  let restored: KvDebugEvent[] = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) restored = JSON.parse(raw);
  } catch {
    restored = [];
  }
  window.__kvEvents = Array.isArray(restored) ? restored : [];
  window.__kvDump = () => JSON.stringify(window.__kvEvents ?? [], null, 1);
  window.__kvClear = () => {
    window.__kvEvents = [];
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };
  return window.__kvEvents;
}

export function kvDebug(tag: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    const events = load();
    events.push({ t: Date.now(), tag, data });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Never let diagnostics break the app.
  }
}
