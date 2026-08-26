/**
 * End-to-end encryption for cross-device config sync.
 * Password → PBKDF2 → AES-GCM key (non-extractable) stored in IndexedDB.
 * Server (Vercel + Upstash) only sees ciphertext; cannot decrypt.
 */

const DB_NAME = 'kvideo-sync';
const DB_STORE = 'keys';
const KEY_ID = 'master';
const SALT = new Uint8Array([
  0x6b, 0x76, 0x69, 0x64, 0x65, 0x6f, 0x2d, 0x73,
  0x79, 0x6e, 0x63, 0x2d, 0x76, 0x31, 0x5f, 0x21,
]);
const PBKDF2_ITERATIONS = 250_000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putKey(key: CryptoKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getStoredKey(): Promise<CryptoKey | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(KEY_ID);
    req.onsuccess = () => resolve((req.result as CryptoKey) || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteStoredKey(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deriveAndStoreSyncKey(password: string): Promise<void> {
  if (typeof window === 'undefined' || !password) return;

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  await putKey(key);
}

export async function clearSyncKey(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await deleteStoredKey();
  } catch {
    // Ignore
  }
}

export async function hasSyncKey(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return !!(await getStoredKey());
  } catch {
    return false;
  }
}

export async function encryptPayload(plaintext: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const key = await getStoredKey();
  if (!key) return null;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export async function decryptPayload(base64: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const key = await getStoredKey();
  if (!key) return null;

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
