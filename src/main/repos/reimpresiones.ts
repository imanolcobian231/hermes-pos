import type { Reimpresion } from '@shared/types'
import { obtenerDb } from '../db'
import { aReimpresion } from '../db/mapeo'

export function listar(): Reimpresion[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM reimpresiones ORDER BY reimprimir_en DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aReimpresion)
}

export function registrar(
  tipo: Reimpresion['tipo'],
  ordenId: number,
  usuario = 'caja'
): Reimpresion {
  const db = obtenerDb()
  const r = db
    .prepare(
      'INSERT INTO reimpresiones (tipo, orden_id, usuario, reimprimir_en) VALUES (?, ?, ?, ?)'
    )
    .run(tipo, ordenId, usuario, new Date().toISOString())
  const fila = db.prepare('SELECT * FROM reimpresiones WHERE id = ?').get(Number(r.lastInsertRowid)) as Record<
    string,
    unknown
  >
  return aReimpresion(fila)
}
