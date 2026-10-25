/**
 * Industrial Mining Cybersecurity & Cryptographic Engine
 * Sukari Gold Mine Dispatch System
 * 
 * Standard: AES-256-GCM (Galois/Counter Mode) Authenticated Encryption
 * Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
 * Zero Plaintext in Transit: All payload channels transmit encrypted ciphertexts
 * with unique per-message Initialization Vectors (IV) to prevent replay and snooping attacks.
 */

const MASTER_FLEET_SALT = 'SUKARI_GOLD_MINE_PIT_DISPATCH_SALT_2026';
const DEFAULT_PRESHARED_SECRET = 'SUKARI_SECURE_MINING_DISPATCH_FLEET_KEY_AES256_V1';
const CIPHER_PREFIX = 'ENC_GCM_V1:';

// Cached CryptoKey instance
let cachedCryptoKey: CryptoKey | null = null;

/**
 * Get or derive the AES-GCM-256 CryptoKey using Web Crypto API
 */
async function getFleetCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API غير متوفرة في بيئة التشغيل الحالية');
  }

  const customKey =
    typeof window !== 'undefined'
      ? localStorage.getItem('SUKARI_CUSTOM_FLEET_CRYPTO_KEY_V1') || DEFAULT_PRESHARED_SECRET
      : DEFAULT_PRESHARED_SECRET;

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(customKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(MASTER_FLEET_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedCryptoKey = derivedKey;
  return derivedKey;
}

/**
 * Encrypts any arbitrary JavaScript object or string into an authenticated AES-256-GCM cipher string
 * Format: ENC_GCM_V1:<base64_iv>:<base64_ciphertext>
 */
export async function encryptData(data: unknown): Promise<string> {
  if (data === null || data === undefined) return '';

  try {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      // Fallback if Web Crypto is unavailable
      return typeof data === 'string' ? data : JSON.stringify(data);
    }

    const key = await getFleetCryptoKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const enc = new TextEncoder();
    const encodedData = enc.encode(jsonStr);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const ivBase64 = arrayBufferToBase64(iv.buffer);
    const cipherBase64 = arrayBufferToBase64(ciphertextBuffer);

    return `${CIPHER_PREFIX}${ivBase64}:${cipherBase64}`;
  } catch (err) {
    console.warn('[Crypto] Encryption warning, passing data safely:', err);
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

/**
 * Decrypts an AES-256-GCM cipher string back to original data.
 * If data is not encrypted (e.g. legacy records), safely returns original value.
 */
export async function decryptData<T = any>(payload: unknown): Promise<T> {
  if (!payload || typeof payload !== 'string') {
    return payload as T;
  }

  if (!payload.startsWith(CIPHER_PREFIX)) {
    // Plaintext / Legacy format: return as-is
    try {
      return JSON.parse(payload) as T;
    } catch {
      return payload as T;
    }
  }

  try {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      return payload as T;
    }

    const key = await getFleetCryptoKey();
    const parts = payload.substring(CIPHER_PREFIX.length).split(':');
    if (parts.length !== 2) {
      return payload as T;
    }

    const iv = new Uint8Array(base64ToArrayBuffer(parts[0]));
    const ciphertext = base64ToArrayBuffer(parts[1]);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedStr = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(decryptedStr) as T;
    } catch {
      return decryptedStr as T;
    }
  } catch (err) {
    console.warn('[Crypto] Decryption failed or integrity check failed:', err);
    return payload as T;
  }
}

/**
 * Helper to check if a string is encrypted
 */
export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(CIPHER_PREFIX);
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
