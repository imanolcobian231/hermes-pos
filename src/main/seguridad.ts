import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// Hash de PIN con scrypt (incluido en Node, sin dependencias nativas extra).
// Formato almacenado: "<salt hex>:<hash hex>".

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verificarPin(pin: string, almacenado: string): boolean {
  const [saltHex, hashHex] = almacenado.split(':')
  if (!saltHex || !hashHex) return false
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado)
}
