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

  // "Ventas" = dinero cobrado SIN propinas (la propina no es venta del negocio).
  // Los pagos se pre-agregan por orden (subconsulta) para restar la propina una
  // sola vez por venta, aunque el pago sea mixto (varias filas en `pagos`).
  const pagosPorOrden = 'SELECT orden_id, SUM(monto) AS monto FROM pagos GROUP BY orden_id'

  const tot = db
    .prepare(
      `SELECT COALESCE(SUM(pg.monto - o.propina), 0) AS ventas, COUNT(o.id) AS num
       FROM ordenes o JOIN (${pagosPorOrden}) pg ON pg.orden_id = o.id
       WHERE ${filtro}`
    )
    .get(...rango) as { ventas: number; num: number }

  const desc = db
    .prepare(
      `SELECT COALESCE(SUM(descuento), 0) AS d, COALESCE(SUM(propina), 0) AS prop
       FROM ordenes o WHERE ${filtro}`
    )
    .get(...rango) as { d: number; prop: number }

  const porDia = db
    .prepare(
      `SELECT date(o.cerrado_en, 'localtime') AS fecha,
              COALESCE(SUM(pg.monto - o.propina), 0) AS ventas,
              COUNT(o.id) AS numOrdenes
       FROM ordenes o JOIN (${pagosPorOrden}) pg ON pg.orden_id = o.id
       WHERE ${filtro}
       GROUP BY fecha ORDER BY fecha`
    )
    .all(...rango) as VentaDia[]

  const topProductos = db
    .prepare(
      `SELECT d.nombre_producto AS nombre,
              SUM(d.cantidad) AS cantidad,
              SUM(d.cantidad * d.precio_unitario - d.descuento) AS importe
       FROM detalle_ordenes d JOIN ordenes o ON o.id = d.orden_id
       WHERE ${filtro}
       GROUP BY d.nombre_producto ORDER BY cantidad DESC, importe DESC LIMIT ?`
    )
    .all(...rango, TOP) as ProductoVendido[]

  // Utilidad: ingreso de productos − descuentos − costo (costo actual del producto).
  // El ingreso ya resta el descuento por línea (producto); abajo se resta también
  // el descuento a nivel de orden (desc.d) para no inflar la utilidad.
  const util = db
    .prepare(
      `SELECT COALESCE(SUM(d.cantidad * d.precio_unitario - d.descuento), 0) AS ingreso,
              COALESCE(SUM(d.cantidad * COALESCE(pr.costo, 0)), 0) AS costo
       FROM detalle_ordenes d
       JOIN ordenes o ON o.id = d.orden_id
       LEFT JOIN productos pr ON pr.id = d.producto_id
       WHERE ${filtro}`
    )
    .get(...rango) as { ingreso: number; costo: number }

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
      descuentos: desc.d,
      propinas: desc.prop,
      costoVendido: util.costo,
      utilidad: util.ingreso - desc.d - util.costo
    },
    porDia,
    topProductos,
    porMetodo: met
  }
}
