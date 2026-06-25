import type { Cancelacion } from '@shared/types'
import { obtenerDb } from '../db'
import { aCancelacion } from '../db/mapeo'

// Auditoría de órdenes canceladas: deja registro de motivo, usuario y monto.
// Las del turno actual (corte_id IS NULL) se muestran en el corte y se archivan
// al cerrarlo.

const ahora = (): string => new Date().toISOString()

/** Registra la cancelación de una orden (motivo obligatorio). */
export function registrar(
  ordenId: number,
  motivo: string,
  usuario: string,
  total: number
): Cancelacion {
  const db = obtenerDb()
  const r = db
    .prepare(
      `INSERT INTO cancelaciones (orden_id, motivo, usuario, total, cancelado_en)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ordenId, motivo, usuario, total, ahora())
  const fila = db
    .prepare('SELECT * FROM cancelaciones WHERE id = ?')
    .get(Number(r.lastInsertRowid)) as Record<string, unknown>
  return aCancelacion(fila)
}

/** Cancelaciones del turno actual (aún no incluidas en un corte), recientes primero. */
export function listarTurno(): Cancelacion[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM cancelaciones WHERE corte_id IS NULL ORDER BY cancelado_en DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aCancelacion)
}
