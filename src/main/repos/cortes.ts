import type { CierreCorteInput, Corte, ResumenTurno } from '@shared/types'
import { obtenerDb } from '../db'
import { aCorte } from '../db/mapeo'
import * as gastos from './gastos'
import * as creditos from './creditos'
import { respaldarSilencioso } from '../db/respaldo'

const ahora = (): string => new Date().toISOString()

/** Totales de las órdenes cobradas que aún no pertenecen a ningún corte. */
export function resumenTurno(): ResumenTurno {
  const db = obtenerDb()
  // Los montos por método salen de la tabla de pagos (soporta pago mixto).
  const m = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN p.metodo = 'efectivo'      THEN p.monto ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN p.metodo = 'tarjeta'       THEN p.monto ELSE 0 END), 0) AS tarjeta,
         COALESCE(SUM(CASE WHEN p.metodo = 'transferencia' THEN p.monto ELSE 0 END), 0) AS transferencia
       FROM pagos p
       JOIN ordenes o ON o.id = p.orden_id
       WHERE o.estado = 'cobrada' AND o.corte_id IS NULL`
    )
    .get() as { efectivo: number; tarjeta: number; transferencia: number }
  const c = db
    .prepare("SELECT COUNT(*) AS num FROM ordenes WHERE estado = 'cobrada' AND corte_id IS NULL")
    .get() as { num: number }

  // Los abonos de crédito cobrados en el turno también son dinero que entró.
  const ab = creditos.abonosTurnoPorMetodo()

  return {
    totalEfectivo: m.efectivo + ab.efectivo,
    totalTarjeta: m.tarjeta + ab.tarjeta,
    totalTransferencia: m.transferencia + ab.transferencia,
    totalGastos: gastos.totalTurno(),
    numOrdenes: c.num
  }
}

export function listar(): Corte[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM cortes ORDER BY cerrado_en DESC')
    .all() as Record<string, unknown>[]
  return filas.map(aCorte)
}

/** Cierra el turno: registra el corte y asocia a él las órdenes cobradas pendientes. */
export function cerrar(cuadre: CierreCorteInput = { fondoInicial: 0 }): Corte {
  const db = obtenerDb()
  const resumen = resumenTurno()
  const t = ahora()
  const fondoInicial = Math.max(0, cuadre.fondoInicial || 0)
  // La diferencia solo tiene sentido si se contó el efectivo físicamente.
  const esperado = fondoInicial + resumen.totalEfectivo - resumen.totalGastos
  const contado = cuadre.efectivoContado
  const diferencia = contado != null ? contado - esperado : null

  const cerrarTx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO cortes
           (fecha, total_efectivo, total_tarjeta, total_transferencia, total_gastos, num_ordenes,
            fondo_inicial, efectivo_contado, diferencia, cerrado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        t,
        resumen.totalEfectivo,
        resumen.totalTarjeta,
        resumen.totalTransferencia,
        resumen.totalGastos,
        resumen.numOrdenes,
        fondoInicial,
        contado ?? null,
        diferencia,
        t
      )
    const corteId = Number(r.lastInsertRowid)
    db.prepare("UPDATE ordenes SET corte_id = ? WHERE estado = 'cobrada' AND corte_id IS NULL").run(
      corteId
    )
    // Archiva los gastos, cancelaciones y abonos del turno en este corte.
    db.prepare('UPDATE gastos SET corte_id = ? WHERE corte_id IS NULL').run(corteId)
    db.prepare('UPDATE cancelaciones SET corte_id = ? WHERE corte_id IS NULL').run(corteId)
    creditos.archivarAbonos(corteId)
    return corteId
  })

  const corteId = cerrarTx()
  const fila = db.prepare('SELECT * FROM cortes WHERE id = ?').get(corteId) as Record<
    string,
    unknown
  >
  // El cierre de turno es un punto natural para respaldar la base de datos.
  void respaldarSilencioso()
  return aCorte(fila)
}
