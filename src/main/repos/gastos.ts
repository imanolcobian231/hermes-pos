import type { Gasto, TipoSalida } from '@shared/types'
import { obtenerDb } from '../db'
import { aGasto } from '../db/mapeo'

// Gastos y retiros del turno actual = los que aún no pertenecen a un corte
// (corte_id IS NULL). Un 'gasto' baja el balance; un 'retiro' solo baja el
// efectivo esperado en el cajón.

export function listarTurno(): Gasto[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM gastos WHERE corte_id IS NULL ORDER BY fecha DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aGasto)
}

/** Total del turno de un tipo ('gasto' por defecto, o 'retiro'). */
export function totalTurno(tipo: TipoSalida = 'gasto'): number {
  const r = obtenerDb()
    .prepare('SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE corte_id IS NULL AND tipo = ?')
    .get(tipo) as { total: number }
  return r.total
}

export function crear(concepto: string, monto: number, tipo: TipoSalida = 'gasto'): Gasto {
  const db = obtenerDb()
  const r = db
    .prepare('INSERT INTO gastos (concepto, monto, fecha, tipo) VALUES (?, ?, ?, ?)')
    .run(concepto.trim(), Math.max(0, monto), new Date().toISOString(), tipo)
  const fila = db.prepare('SELECT * FROM gastos WHERE id = ?').get(Number(r.lastInsertRowid)) as Record<
    string,
    unknown
  >
  return aGasto(fila)
}

export function eliminar(id: number): void {
  obtenerDb().prepare('DELETE FROM gastos WHERE id = ?').run(id)
}
