import type { ConfigImpresoras, ConfigRespaldo } from '@shared/types'
import { obtenerDb } from '../db'

// Configuración general de la app, guardada como JSON en la tabla `config`.

const CLAVE_IMPRESORAS = 'impresoras'
const CLAVE_RESPALDO = 'respaldo'

export const IMPRESORAS_PREDETERMINADO: ConfigImpresoras = {
  nombreNegocio: '',
  direccion: '',
  telefono: '',
  modo: 'una',
  caja: null,
  cocina: null,
  cortarPapel: true,
  abrirCajon: false,
  avanceFinal: 4,
  ancho: 32,
  cocinaGrande: true,
  impuestoActivo: false,
  impuestoTasa: 16,
  impuestoIncluido: true
}

function leer<T>(clave: string): T | null {
  const fila = obtenerDb().prepare('SELECT valor FROM config WHERE clave = ?').get(clave) as
    | { valor: string }
    | undefined
  if (!fila) return null
  try {
    return JSON.parse(fila.valor) as T
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown): void {
  obtenerDb()
    .prepare(
      'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
    )
    .run(clave, JSON.stringify(valor))
}

export function obtenerImpresoras(): ConfigImpresoras {
  const guardado = leer<Partial<ConfigImpresoras>>(CLAVE_IMPRESORAS) ?? {}
  // Mezcla con los valores por defecto para tolerar configuraciones parciales.
  return { ...IMPRESORAS_PREDETERMINADO, ...guardado }
}

export function guardarImpresoras(cfg: ConfigImpresoras): ConfigImpresoras {
  escribir(CLAVE_IMPRESORAS, cfg)
  return obtenerImpresoras()
}

export const RESPALDO_PREDETERMINADO: ConfigRespaldo = {
  automatico: true,
  carpeta: null,
  ultimo: null
}

export function obtenerRespaldo(): ConfigRespaldo {
  const guardado = leer<Partial<ConfigRespaldo>>(CLAVE_RESPALDO) ?? {}
  return { ...RESPALDO_PREDETERMINADO, ...guardado }
}

export function guardarRespaldo(cfg: ConfigRespaldo): ConfigRespaldo {
  escribir(CLAVE_RESPALDO, cfg)
  return obtenerRespaldo()
}
