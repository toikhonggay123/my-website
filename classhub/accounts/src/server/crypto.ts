// Security primitives for AFYLLX Account, built on Web Crypto only (Workers and Node 24 alike).
// Passwords: PBKDF2-SHA256, 100 000 iterations (the Workers maximum), 16-byte salt.
// Second factor: TOTP per RFC 6238 (SHA-1, 30 s, 6 digits) with a one-step window.

const encoder = new TextEncoder()
export const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
const fromHex = (value: string) => new Uint8Array(value.match(/../g)!.map(pair => parseInt(pair, 16)))
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))

export const randomHex = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)))
export async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}
/** Compares two strings in time that does not depend on where they differ. */
export function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

const iterations = 100_000
async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, rounds: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256))
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return 'pbkdf2$' + iterations + '$' + hex(salt) + '$' + await pbkdf2(password, salt, iterations)
}
export async function verifyPassword(password: string, stored: string | null) {
  // Without a stored hash, still spend the same work so timing does not reveal unknown accounts.
  const [kind, rounds, salt, hash] = (stored ?? 'pbkdf2$' + iterations + '$' + '00'.repeat(16) + '$' + '00'.repeat(32)).split('$')
  if (kind !== 'pbkdf2') return false
  const derived = await pbkdf2(password, fromHex(salt), Number(rounds))
  return Boolean(stored) && same(derived, hash)
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32(bytes: Uint8Array) {
  let bits = 0, value = 0, output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]
  return output
}
export function fromBase32(text: string) {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0, value = 0
  const output: number[] = []
  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error('Invalid base32')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(output)
}
export const newTotpSecret = () => base32(crypto.getRandomValues(new Uint8Array(20)))

export async function totp(secret: string, step: number) {
  const key = await crypto.subtle.importKey('raw', fromBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const counter = new Uint8Array(8)
  let rest = step
  for (let index = 7; index >= 0; index--) { counter[index] = rest & 255; rest = Math.floor(rest / 256) }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter))
  const offset = mac[mac.length - 1] & 15
  const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(binary % 1_000_000).padStart(6, '0')
}
/** Returns the matching time step, or 0. Steps at or before lastStep are rejected to stop replays. */
export async function verifyTotp(secret: string, code: string, lastStep: number, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return 0
  const current = Math.floor(now / 30_000)
  for (const step of [current - 1, current, current + 1]) {
    if (step > lastStep && same(await totp(secret, step), code)) return step
  }
  return 0
}
export const otpauthUri = (secret: string, email: string) =>
  'otpauth://totp/' + encodeURIComponent('AFYLLX Account:' + email) + '?secret=' + secret + '&issuer=' + encodeURIComponent('AFYLLX Account')
    + '&algorithm=SHA1&digits=6&period=30'

/** Recovery codes look like 4f7k-9qzm: 8 characters without look-alike letters. */
export function recoveryCodes(count = 10) {
  const letters = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: count }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    const text = Array.from(bytes, byte => letters[byte % letters.length]).join('')
    return text.slice(0, 4) + '-' + text.slice(4)
  })
}
export const normalizeRecovery = (code: string) => code.trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2')

async function aesKey(secretHex: string) {
  if (!/^[0-9a-f]{64}$/i.test(secretHex)) throw new Error('ACCOUNTS_ENCRYPTION_KEY must be 64 hex characters')
  return crypto.subtle.importKey('raw', fromHex(secretHex), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
/** Encrypts a short secret (the TOTP seed) at rest. Output: base64(iv).base64(ciphertext). */
export async function seal(plain: string, keyHex: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyHex), encoder.encode(plain)))
  return base64(iv) + '.' + base64(data)
}
export async function unseal(sealed: string, keyHex: string) {
  const [iv, data] = sealed.split('.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await aesKey(keyHex), fromBase64(data))
  return new TextDecoder().decode(plain)
}
