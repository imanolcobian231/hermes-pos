import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { RespaldoInfo } from '@shared/types'
import { obtenerDb } from './conexion'
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

/** Lista los respaldos existentes (recientes primero) para mostrarlos en Ajustes. */
export function listarRespaldos(): RespaldoInfo[] {
  const carpeta = carpetaRespaldos()
  return archivosRespaldo(carpeta).map(({ nombre }) => {
    const st = statSync(join(carpeta, nombre))
    return { nombre, ruta: join(carpeta, nombre), fecha: st.mtime.toISOString(), tamano: st.size }
  })
}
