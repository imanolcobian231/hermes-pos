import type { Gasto } from '@shared/types'
import { obtenerDb } from '../db'
import { aGasto } from '../db/mapeo'

// Gastos del turno actual = los que aún no pertenecen a un corte (corte_id IS NULL).

export function listarTurno(): Gasto[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM gastos WHERE corte_id IS NULL ORDER BY fecha DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aGasto)
}

export function totalTurno(): number {
  const r = obtenerDb()
    .prepare('SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE corte_id IS NULL')
    .get() as { total: number }
  return r.total
}

export function crear(concepto: string, monto: number): Gasto {
  const db = obtenerDb()
  const r = db
    .prepare('INSERT INTO gastos (concepto, monto, fecha) VALUES (?, ?, ?)')
    .run(concepto.trim(), Math.max(0, monto), new Date().toISOString())
  const fila = db.prepare('SELECT * FROM gastos WHERE id = ?').get(Number(r.lastInsertRowid)) as Record<
    string,
    unknown
  >
  return aGasto(fila)
}

export function eliminar(id: number): void {
  obtenerDb().prepare('DELETE FROM gastos WHERE id = ?').run(id)
}
