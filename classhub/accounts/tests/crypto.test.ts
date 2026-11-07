import assert from 'node:assert/strict'
import test from 'node:test'
import {
  base32, fromBase32, hashPassword, normalizeRecovery, recoveryCodes, seal, totp, unseal, verifyPassword, verifyTotp,
} from '../src/server/crypto.ts'

test('TOTP matches the RFC 6238 SHA-1 test vectors', async () => {
  const secret = base32(new TextEncoder().encode('12345678901234567890'))
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  assert.deepEqual(Array.from(fromBase32(secret)), Array.from(new TextEncoder().encode('12345678901234567890')))
  assert.equal(await totp(secret, Math.floor(59 / 30)), '287082')
  assert.equal(await totp(secret, Math.floor(1111111109 / 30)), '081804')
  assert.equal(await totp(secret, Math.floor(2000000000 / 30)), '279037')
})

test('TOTP accepts one step of clock drift and rejects replays', async () => {
  const secret = base32(new TextEncoder().encode('12345678901234567890'))
  const now = 1111111109_000
  const step = Math.floor(now / 30_000)
  assert.equal(await verifyTotp(secret, await totp(secret, step - 1), 0, now), step - 1)
  assert.equal(await verifyTotp(secret, await totp(secret, step + 2), 0, now), 0)
  assert.equal(await verifyTotp(secret, await totp(secret, step), step, now), 0)
  assert.equal(await verifyTotp(secret, '12345', 0, now), 0)
})

test('passwords verify only against their own hash', async () => {
  const stored = await hashPassword('Mot-mat-khau-dai-2026')
  assert.match(stored, /^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
  assert.equal(await verifyPassword('Mot-mat-khau-dai-2026', stored), true)
  assert.equal(await verifyPassword('mot-mat-khau-dai-2026', stored), false)
  assert.equal(await verifyPassword('Mot-mat-khau-dai-2026', null), false)
  assert.notEqual(await hashPassword('Mot-mat-khau-dai-2026'), stored)
})

test('secrets are sealed with AES-GCM and recovery codes normalise', async () => {
  const key = 'ab'.repeat(32)
  const sealed = await seal('GEZDGNBVGY3TQOJQ', key)
  assert.notEqual(sealed, 'GEZDGNBVGY3TQOJQ')
  assert.equal(await unseal(sealed, key), 'GEZDGNBVGY3TQOJQ')
  await assert.rejects(unseal(sealed, 'cd'.repeat(32)))
  const codes = recoveryCodes()
  assert.equal(new Set(codes).size, 10)
  for (const code of codes) assert.match(code, /^[a-z2-9]{4}-[a-z2-9]{4}$/)
  assert.equal(normalizeRecovery(' AB2C D3EF '), 'ab2c-d3ef')
})
