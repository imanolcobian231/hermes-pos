import type { Usuario, UsuarioInput } from '@shared/types'
import { obtenerDb } from '../db'
import { aUsuario } from '../db/mapeo'
import { hashPin, verificarPin } from '../seguridad'

export function listar(): Usuario[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre')
    .all() as Record<string, unknown>[]
  return filas.map(aUsuario)
}

/** True si ya existe al menos un usuario (cuenta también los dados de baja). */
export function hayUsuarios(): boolean {
  const r = obtenerDb().prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number }
  return r.n > 0
}

/**
 * Crea el primer administrador en la instalación. Solo funciona cuando no hay
 * ningún usuario todavía; en cualquier otro caso lanza error (los usuarios
 * adicionales se crean desde la pantalla de Usuarios con un admin ya logueado).
 */
export function crearPrimerAdmin(nombre: string, pin: string): Usuario {
  if (hayUsuarios()) throw new Error('Ya existe al menos un usuario')
  if (!pin || !pin.trim()) throw new Error('El PIN es obligatorio')
  const r = obtenerDb()
    .prepare("INSERT INTO usuarios (nombre, pin_hash, rol) VALUES (?, ?, 'admin')")
    .run(nombre.trim() || 'Administrador', hashPin(pin.trim()))
  return obtener(Number(r.lastInsertRowid))
}

/** Verifica el PIN del usuario indicado. Devuelve el usuario o null si no coincide. */
export function login(usuarioId: number, pin: string): Usuario | null {
  const fila = obtenerDb().prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(usuarioId) as
    | Record<string, unknown>
    | undefined
  if (!fila) return null
  if (!verificarPin(pin, fila.pin_hash as string)) return null
  return aUsuario(fila)
}

/** True si el PIN corresponde a algún administrador activo (autorizaciones). */
export function verificarPinAdmin(pin: string): boolean {
  if (!pin) return false
  const filas = obtenerDb()
    .prepare("SELECT pin_hash FROM usuarios WHERE rol = 'admin' AND activo = 1")
    .all() as { pin_hash: string }[]
  return filas.some((f) => verificarPin(pin, f.pin_hash))
}

export function guardar(u: UsuarioInput): Usuario {
  const db = obtenerDb()
  if (u.id != null) {
    db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, email = ? WHERE id = ?').run(
      u.nombre.trim(),
      u.rol,
      u.email?.trim() || null,
      u.id
    )
    if (u.pin && u.pin.trim()) {
      db.prepare('UPDATE usuarios SET pin_hash = ? WHERE id = ?').run(hashPin(u.pin.trim()), u.id)
    }
    return obtener(u.id)
  }
  if (!u.pin || !u.pin.trim()) throw new Error('El PIN es obligatorio para un usuario nuevo')
  const r = db
    .prepare('INSERT INTO usuarios (nombre, pin_hash, rol, email) VALUES (?, ?, ?, ?)')
    .run(u.nombre.trim(), hashPin(u.pin.trim()), u.rol, u.email?.trim() || null)
  return obtener(Number(r.lastInsertRowid))
}

export function eliminar(id: number): void {
  const db = obtenerDb()
  const admins = db
    .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1")
    .get() as { n: number }
  const objetivo = obtener(id)
  if (objetivo.rol === 'admin' && admins.n <= 1) {
    throw new Error('No puedes eliminar al único administrador')
  }
  // Baja lógica para no romper referencias históricas.
  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(id)
}

function obtener(id: number): Usuario {
  const fila = obtenerDb().prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as Record<
    string,
    unknown
  >
  return aUsuario(fila)
}
