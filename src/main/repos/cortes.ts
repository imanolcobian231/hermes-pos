import type { Corte, ResumenTurno } from '@shared/types'
import { obtenerDb } from '../db'
import { aCorte } from '../db/mapeo'
import * as gastos from './gastos'

const ahora = (): string => new Date().toISOString()

/** Totales de las órdenes cobradas que aún no pertenecen a ningún corte. */
export function resumenTurno(): ResumenTurno {
  const r = obtenerDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo'      THEN total - descuento ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta'       THEN total - descuento ELSE 0 END), 0) AS tarjeta,
         COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total - descuento ELSE 0 END), 0) AS transferencia,
         COUNT(*) AS num
       FROM ordenes
       WHERE estado = 'cobrada' AND corte_id IS NULL`
    )
    .get() as { efectivo: number; tarjeta: number; transferencia: number; num: number }

  return {
    totalEfectivo: r.efectivo,
    totalTarjeta: r.tarjeta,
    totalTransferencia: r.transferencia,
    totalGastos: gastos.totalTurno(),
    numOrdenes: r.num
  }
}

export function listar(): Corte[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM cortes ORDER BY cerrado_en DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aCorte)
}

/** Cierra el turno: registra el corte y asocia a él las órdenes cobradas pendientes. */
export function cerrar(): Corte {
  const db = obtenerDb()
  const resumen = resumenTurno()
  const t = ahora()

  const cerrarTx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO cortes
           (fecha, total_efectivo, total_tarjeta, total_transferencia, total_gastos, num_ordenes, cerrado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        t,
        resumen.totalEfectivo,
        resumen.totalTarjeta,
        resumen.totalTransferencia,
        resumen.totalGastos,
        resumen.numOrdenes,
        t
      )
    const corteId = Number(r.lastInsertRowid)
    db.prepare("UPDATE ordenes SET corte_id = ? WHERE estado = 'cobrada' AND corte_id IS NULL").run(
      corteId
    )
    // Archiva también los gastos del turno en este corte.
    db.prepare('UPDATE gastos SET corte_id = ? WHERE corte_id IS NULL').run(corteId)
    return corteId
  })

  const corteId = cerrarTx()
  const fila = db.prepare('SELECT * FROM cortes WHERE id = ?').get(corteId) as Record<
    string,
    unknown
  >
  return aCorte(fila)
}
