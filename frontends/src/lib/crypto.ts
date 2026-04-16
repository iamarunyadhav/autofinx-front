// Lightweight client-side encryption to store API keys obfuscated at rest.
// Note: Secrets in the browser are not fully secure; use a backend vault for production.

const PASSPHRASE = import.meta.env.VITE_ENCRYPTION_PASSPHRASE || 'autofinx_demo_key';

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = enc.encode('autofinx-salt');
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(PASSPHRASE), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plain);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const buff = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.byteLength + buff.byteLength);
  combined.set(iv, 0);
  combined.set(buff, iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptSecret(encoded: string): Promise<string> {
  const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const key = await deriveKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
