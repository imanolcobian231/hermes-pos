import type {
  ProductoVendido,
  ReporteVentas,
  VentaDia,
  VentasPorMetodo
} from '@shared/types'
import { obtenerDb } from '../db'

// Reportes históricos de ventas (solo lectura). Las fechas se agrupan por día
// LOCAL (cerrado_en se guarda en UTC), con date(cerrado_en, 'localtime'). El
// rango [desde, hasta] es inclusivo y usa el formato YYYY-MM-DD.

const TOP = 15

/** Genera el reporte completo de ventas para un rango de fechas. */
export function generar(desde: string, hasta: string): ReporteVentas {
  const db = obtenerDb()
  const rango = [desde, hasta]
  const filtro = "o.estado = 'cobrada' AND date(o.cerrado_en, 'localtime') BETWEEN ? AND ?"

  const tot = db
    .prepare(
      `SELECT COALESCE(SUM(p.monto), 0) AS ventas, COUNT(DISTINCT o.id) AS num
       FROM ordenes o JOIN pagos p ON p.orden_id = o.id
       WHERE ${filtro}`
    )
    .get(...rango) as { ventas: number; num: number }

  const desc = db
    .prepare(
      `SELECT COALESCE(SUM(descuento), 0) AS d FROM ordenes o WHERE ${filtro}`
    )
    .get(...rango) as { d: number }

  const porDia = db
    .prepare(
      `SELECT date(o.cerrado_en, 'localtime') AS fecha,
              COALESCE(SUM(p.monto), 0) AS ventas,
              COUNT(DISTINCT o.id) AS numOrdenes
       FROM ordenes o JOIN pagos p ON p.orden_id = o.id
       WHERE ${filtro}
       GROUP BY fecha ORDER BY fecha`
    )
    .all(...rango) as VentaDia[]

  const topProductos = db
    .prepare(
      `SELECT d.nombre_producto AS nombre,
              SUM(d.cantidad) AS cantidad,
              SUM(d.cantidad * d.precio_unitario) AS importe
       FROM detalle_ordenes d JOIN ordenes o ON o.id = d.orden_id
       WHERE ${filtro}
       GROUP BY d.nombre_producto ORDER BY cantidad DESC, importe DESC LIMIT ?`
    )
    .all(...rango, TOP) as ProductoVendido[]

  const met = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN p.metodo = 'efectivo'      THEN p.monto ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN p.metodo = 'tarjeta'       THEN p.monto ELSE 0 END), 0) AS tarjeta,
         COALESCE(SUM(CASE WHEN p.metodo = 'transferencia' THEN p.monto ELSE 0 END), 0) AS transferencia
       FROM ordenes o JOIN pagos p ON p.orden_id = o.id
       WHERE ${filtro}`
    )
    .get(...rango) as VentasPorMetodo

  return {
    desde,
    hasta,
    resumen: {
      ventas: tot.ventas,
      numOrdenes: tot.num,
      ticketPromedio: tot.num > 0 ? tot.ventas / tot.num : 0,
      descuentos: desc.d
    },
    porDia,
    topProductos,
    porMetodo: met
  }
}
