import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import type { RespaldoInfo } from '@shared/types'
import { obtenerDb, cerrarDb } from './conexion'
import { inicializarDb } from './index'
import { obtenerRespaldo, guardarRespaldo } from '../repos/config'

// Respaldo de la base de datos SQLite. Usa db.backup(), que hace una copia
// consistente incluso con el modo WAL activo (no basta con copiar el archivo).
// Se conservan los últimos MAX_RESPALDOS y se purga el resto.

const MAX_RESPALDOS = 14
const PATRON = /^hermes-.*\.db$/

/** Carpeta por defecto (dentro de los datos de la app). */
export function carpetaPredeterminada(): string {
  return join(app.getPath('userData'), 'respaldos')
}

/** Carpeta destino efectiva (configurada o la predeterminada), ya creada. */
export function carpetaRespaldos(): string {
  const carpeta = obtenerRespaldo().carpeta || carpetaPredeterminada()
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true })
  return carpeta
}

// Sello de tiempo legible y ordenable para el nombre del archivo (YYYY-MM-DD_HH-mm).
function sello(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`
}

function archivosRespaldo(carpeta: string): { nombre: string; t: number }[] {
  return readdirSync(carpeta)
    .filter((f) => PATRON.test(f))
    .map((nombre) => ({ nombre, t: statSync(join(carpeta, nombre)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
}

function purgar(carpeta: string): void {
  for (const viejo of archivosRespaldo(carpeta).slice(MAX_RESPALDOS)) {
    try {
      unlinkSync(join(carpeta, viejo.nombre))
    } catch {
      /* ignora */
    }
  }
}

/** Crea un respaldo de la base de datos y devuelve la ruta del archivo creado. */
export async function respaldar(): Promise<string> {
  const carpeta = carpetaRespaldos()
  const destino = join(carpeta, `hermes-${sello()}.db`)
  await obtenerDb().backup(destino)
  purgar(carpeta)
  guardarRespaldo({ ...obtenerRespaldo(), ultimo: new Date().toISOString() })
  return destino
}

/** Respalda sin lanzar errores; respeta el ajuste de respaldo automático. */
export async function respaldarSilencioso(): Promise<void> {
  try {
    if (!obtenerRespaldo().automatico) return
    await respaldar()
  } catch (e) {
    console.error('Respaldo automático falló:', e)
  }
}

/** Al arrancar la app: respalda si está activo y aún no hay respaldo de hoy. */
export async function respaldoDiarioSiHaceFalta(): Promise<void> {
  const { automatico, ultimo } = obtenerRespaldo()
  if (!automatico) return
  if (ultimo) {
    const u = new Date(ultimo)
    const h = new Date()
    const mismoDia =
      u.getFullYear() === h.getFullYear() && u.getMonth() === h.getMonth() && u.getDate() === h.getDate()
    if (mismoDia) return
  }
  await respaldarSilencioso()
}

/**
 * Restaura la base de datos desde un respaldo (por nombre de archivo dentro de
 * la carpeta de respaldos). Antes hace un respaldo de seguridad del estado
 * actual, cierra la conexión, sobrescribe la base y la reabre.
 */
export async function restaurar(nombre: string): Promise<void> {
  const carpeta = carpetaRespaldos()
  const archivo = basename(nombre)
  const origen = join(carpeta, archivo)
  if (!PATRON.test(archivo) || !existsSync(origen)) throw new Error('Respaldo no válido')
  // Copia el origen a un temporal ANTES del snapshot de seguridad: así no se
  // pierde aunque el snapshot genere un nombre que colisione con este respaldo.
  const fuente = join(tmpdir(), `hermes-restore-${Date.now()}.db`)
  copyFileSync(origen, fuente)
  // Snapshot de seguridad del estado actual antes de sobrescribir.
  try {
    await respaldar()
  } catch {
    /* si falla el snapshot, la restauración sigue siendo prioritaria */
  }
  const destino = join(app.getPath('userData'), 'hermes.db')
  cerrarDb()
  copyFileSync(fuente, destino)
  try {
    unlinkSync(fuente)
  } catch {
    /* limpieza best-effort */
  }
  // Quita los archivos WAL para que se use exactamente la base restaurada.
  for (const suf of ['-wal', '-shm']) {
    try {
      unlinkSync(destino + suf)
    } catch {
      /* puede no existir */
    }
  }
  inicializarDb()
}

/** Lista los respaldos existentes (recientes primero) para mostrarlos en Ajustes. */
export function listarRespaldos(): RespaldoInfo[] {
  const carpeta = carpetaRespaldos()
  return archivosRespaldo(carpeta).map(({ nombre }) => {
    const st = statSync(join(carpeta, nombre))
    return { nombre, ruta: join(carpeta, nombre), fecha: st.mtime.toISOString(), tamano: st.size }
  })
}
