import type { DetalleOrden, MetodoPagoOrden, OrdenConDetalle, Pago } from '@shared/types'
import { calcularImpuesto } from '@shared/impuestos'
import { obtenerDb } from '../db'
import { aDetalle, aDetalleModificador, aOrden } from '../db/mapeo'
import * as mesas from './mesas'
import * as cancelaciones from './cancelaciones'
import * as creditos from './creditos'
import { obtenerImpresoras } from './config'

const ahora = (): string => new Date().toISOString()

// --- Lectura ---------------------------------------------------------------

function modificadoresDe(detalleId: number): ReturnType<typeof aDetalleModificador>[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM detalle_modificadores WHERE detalle_id = ? ORDER BY id')
    .all(detalleId) as Record<string, unknown>[]
  return filas.map(aDetalleModificador)
}

function detalleDe(ordenId: number): DetalleOrden[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM detalle_ordenes WHERE orden_id = ? ORDER BY id')
    .all(ordenId) as Record<string, unknown>[]
  return filas.map((f) => aDetalle(f, modificadoresDe(f.id as number)))
}

function pagosDe(ordenId: number): Pago[] {
  const filas = obtenerDb()
    .prepare('SELECT metodo, monto FROM pagos WHERE orden_id = ? ORDER BY id')
    .all(ordenId) as { metodo: Pago['metodo']; monto: number }[]
  return filas.map((f) => ({ metodo: f.metodo, monto: f.monto }))
}

export function obtenerConDetalle(ordenId: number): OrdenConDetalle {
  const fila = obtenerDb().prepare('SELECT * FROM ordenes WHERE id = ?').get(ordenId) as
    | Record<string, unknown>
    | undefined
  if (!fila) throw new Error(`Orden ${ordenId} no encontrada`)
  return { ...aOrden(fila), detalle: detalleDe(ordenId), pagos: pagosDe(ordenId) }
}

/** Órdenes abiertas (mesas ocupadas o por cobrar) con su detalle. */
export function listarActivas(): OrdenConDetalle[] {
  const filas = obtenerDb()
    .prepare("SELECT * FROM ordenes WHERE estado = 'abierta' ORDER BY abierto_en")
    .all() as Record<string, unknown>[]
  return filas.map((f) => ({ ...aOrden(f), detalle: detalleDe(f.id as number), pagos: [] }))
}

/** Órdenes cobradas del turno actual (aún no incluidas en un corte), recientes primero. */
export function cobradasTurno(): OrdenConDetalle[] {
  const filas = obtenerDb()
    .prepare(
      "SELECT * FROM ordenes WHERE estado = 'cobrada' AND corte_id IS NULL ORDER BY cerrado_en DESC"
    )
    .all() as Record<string, unknown>[]
  return filas.map((f) => ({
    ...aOrden(f),
    detalle: detalleDe(f.id as number),
    pagos: pagosDe(f.id as number)
  }))
}

export function ordenDeMesa(mesaId: number): OrdenConDetalle | undefined {
  const fila = obtenerDb()
    .prepare("SELECT * FROM ordenes WHERE mesa_id = ? AND estado = 'abierta' LIMIT 1")
    .get(mesaId) as Record<string, unknown> | undefined
  if (!fila) return undefined
  return { ...aOrden(fila), detalle: detalleDe(fila.id as number) }
}

// --- Escritura -------------------------------------------------------------

function recalcularTotal(ordenId: number): void {
  obtenerDb()
    .prepare(
      `UPDATE ordenes SET total = (
         SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
         FROM detalle_ordenes WHERE orden_id = ?
       ) WHERE id = ?`
    )
    .run(ordenId, ordenId)
}

export function abrir(mesaId: number): OrdenConDetalle {
  const existente = ordenDeMesa(mesaId)
  if (existente) return existente

  const db = obtenerDb()
  const r = db
    .prepare(
      "INSERT INTO ordenes (mesa_id, para_llevar, estado, total, abierto_en) VALUES (?, 0, 'abierta', 0, ?)"
    )
    .run(mesaId, ahora())
  mesas.cambiarEstado(mesaId, 'ocupada')
  return obtenerConDetalle(Number(r.lastInsertRowid))
}

/** Abre una orden para llevar (sin mesa física), con etiqueta secuencial. */
export function abrirLlevar(): OrdenConDetalle {
  const db = obtenerDb()
  const previas = db.prepare('SELECT COUNT(*) AS n FROM ordenes WHERE para_llevar = 1').get() as {
    n: number
  }
  const nombre = `Para llevar #${previas.n + 1}`
  const r = db
    .prepare(
      "INSERT INTO ordenes (mesa_id, para_llevar, nombre, estado, total, abierto_en) VALUES (NULL, 1, ?, 'abierta', 0, ?)"
    )
    .run(nombre, ahora())
  return obtenerConDetalle(Number(r.lastInsertRowid))
}

export function agregarProducto(
  ordenId: number,
  productoId: number,
  modificadorIds: number[] = [],
  comensal = 1
): OrdenConDetalle {
  const db = obtenerDb()
  const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(productoId) as
    | Record<string, unknown>
    | undefined
  if (!prod) throw new Error(`Producto ${productoId} no encontrado`)

  // Modificadores elegidos (validados contra los grupos del producto).
  const mods =
    modificadorIds.length > 0
      ? (db
          .prepare(
            `SELECT m.* FROM modificadores m
               JOIN producto_grupos pg ON pg.grupo_id = m.grupo_id
             WHERE pg.producto_id = ? AND m.id IN (${modificadorIds.map(() => '?').join(',')})`
          )
          .all(productoId, ...modificadorIds) as Record<string, unknown>[])
      : []
  const extra = mods.reduce((acc, m) => acc + (m.precio as number), 0)
  const precioEfectivo = (prod.precio as number) + extra

  const tx = db.transaction(() => {
    // Solo agrupa líneas sin modificadores ni notas (idénticas).
    const linea =
      mods.length === 0
        ? (db
            .prepare(
              "SELECT d.* FROM detalle_ordenes d WHERE d.orden_id = ? AND d.producto_id = ? AND d.comensal = ? AND d.enviado_cocina = 0 AND (d.notas IS NULL OR d.notas = '') AND NOT EXISTS (SELECT 1 FROM detalle_modificadores dm WHERE dm.detalle_id = d.id) LIMIT 1"
            )
            .get(ordenId, productoId, comensal) as Record<string, unknown> | undefined)
        : undefined

    if (linea) {
      db.prepare('UPDATE detalle_ordenes SET cantidad = cantidad + 1 WHERE id = ?').run(linea.id)
    } else {
      const r = db
        .prepare(
          `INSERT INTO detalle_ordenes
             (orden_id, producto_id, nombre_producto, cantidad, precio_unitario, comensal, enviado_cocina)
           VALUES (?, ?, ?, 1, ?, ?, 0)`
        )
        .run(ordenId, productoId, prod.nombre, precioEfectivo, comensal)
      const detalleId = Number(r.lastInsertRowid)
      const insMod = db.prepare(
        'INSERT INTO detalle_modificadores (detalle_id, modificador_id, nombre, precio) VALUES (?, ?, ?, ?)'
      )
      for (const m of mods) insMod.run(detalleId, m.id, m.nombre, m.precio)
    }
    recalcularTotal(ordenId)
  })
  tx()
  return obtenerConDetalle(ordenId)
}

export function cambiarCantidad(
  ordenId: number,
  detalleId: number,
  delta: number
): OrdenConDetalle {
  const db = obtenerDb()
  const linea = db.prepare('SELECT * FROM detalle_ordenes WHERE id = ?').get(detalleId) as
    | Record<string, unknown>
    | undefined
  if (linea) {
    const enviado = Boolean(linea.enviado_cocina)
    const nueva = Math.max(0, (linea.cantidad as number) + delta)
    // Las líneas no enviadas pueden eliminarse al llegar a 0; las enviadas no.
    if (nueva === 0 && !enviado) {
      db.prepare('DELETE FROM detalle_ordenes WHERE id = ?').run(detalleId)
    } else if (nueva > 0) {
      db.prepare('UPDATE detalle_ordenes SET cantidad = ? WHERE id = ?').run(nueva, detalleId)
    }
    recalcularTotal(ordenId)
  }
  return obtenerConDetalle(ordenId)
}

export function cambiarNota(ordenId: number, detalleId: number, nota: string): OrdenConDetalle {
  const limpia = nota.trim()
  obtenerDb()
    .prepare('UPDATE detalle_ordenes SET notas = ? WHERE id = ?')
    .run(limpia || null, detalleId)
  return obtenerConDetalle(ordenId)
}

export function quitarLinea(ordenId: number, detalleId: number): OrdenConDetalle {
  const db = obtenerDb()
  db.prepare('DELETE FROM detalle_ordenes WHERE id = ?').run(detalleId)
  recalcularTotal(ordenId)
  return obtenerConDetalle(ordenId)
}

/**
 * Marca como enviadas las líneas pendientes y devuelve solo esas (ticket diferencial).
 * Si se pasa `comensal`, solo envía las de ese comensal.
 */
export function enviarACocina(ordenId: number, comensal?: number): DetalleOrden[] {
  const db = obtenerDb()
  const filtro = comensal != null ? ' AND comensal = ?' : ''
  const argsSel = comensal != null ? [ordenId, comensal] : [ordenId]

  const pendientes = db
    .prepare(`SELECT * FROM detalle_ordenes WHERE orden_id = ? AND enviado_cocina = 0${filtro}`)
    .all(...argsSel) as Record<string, unknown>[]
  if (pendientes.length === 0) return []

  const enviadoEn = ahora()
  const argsUpd = comensal != null ? [enviadoEn, ordenId, comensal] : [enviadoEn, ordenId]
  db.prepare(
    `UPDATE detalle_ordenes SET enviado_cocina = 1, enviado_en = ? WHERE orden_id = ? AND enviado_cocina = 0${filtro}`
  ).run(...argsUpd)

  return pendientes.map((p) =>
    aDetalle({ ...p, enviado_cocina: 1, enviado_en: enviadoEn }, modificadoresDe(p.id as number))
  )
}

export function marcarPorCobrar(ordenId: number): OrdenConDetalle {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  db.prepare('UPDATE ordenes SET por_cobrar = 1 WHERE id = ?').run(ordenId)
  if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'por_cobrar')
  return obtenerConDetalle(ordenId)
}

/**
 * Cobra una orden con uno o varios pagos (pago mixto). `pagos` es el desglose
 * por método cuya suma cubre el total a pagar. `efectivoRecibido` es el efectivo
 * entregado (solo para calcular el cambio de la parte en efectivo).
 */
export function cobrar(
  ordenId: number,
  pagos: Pago[],
  efectivoRecibido?: number,
  descuento = 0
): OrdenConDetalle {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  const desc = Math.max(0, Math.min(descuento, orden.total)) // no mayor al subtotal

  // Descarta montos no positivos; debe quedar al menos un pago.
  const limpios = pagos.filter((p) => p.monto > 0)
  if (limpios.length === 0) throw new Error('Se requiere al menos un pago')

  const metodos = [...new Set(limpios.map((p) => p.metodo))]
  const metodoGuardado: MetodoPagoOrden = metodos.length > 1 ? 'mixto' : metodos[0]
  const efectivoAplicado = limpios
    .filter((p) => p.metodo === 'efectivo')
    .reduce((s, p) => s + p.monto, 0)
  // El cambio solo aplica a la parte en efectivo (cuando se recibe de más).
  const recibido = efectivoRecibido ?? efectivoAplicado
  const cambio = efectivoAplicado > 0 ? Math.max(0, recibido - efectivoAplicado) : 0

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE ordenes
         SET estado = 'cobrada', descuento = ?, metodo_pago = ?, monto_recibido = ?, cambio = ?,
             ticket_impreso = 1, cerrado_en = ?
       WHERE id = ?`
    ).run(desc, metodoGuardado, recibido, cambio, ahora(), ordenId)
    // Reemplaza los pagos (por si se recobra) y registra el desglose.
    db.prepare('DELETE FROM pagos WHERE orden_id = ?').run(ordenId)
    const ins = db.prepare('INSERT INTO pagos (orden_id, metodo, monto) VALUES (?, ?, ?)')
    for (const p of limpios) ins.run(ordenId, p.metodo, p.monto)
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
  return obtenerConDetalle(ordenId)
}

/**
 * Fía una orden: la marca cobrada como 'credito' y carga el total a la cuenta
 * del cliente. No registra un pago (no entró dinero al momento).
 */
export function fiar(ordenId: number, clienteId: number, descuento = 0): OrdenConDetalle {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  const desc = Math.max(0, Math.min(descuento, orden.total))
  const neto = orden.total - desc
  const aPagar = calcularImpuesto(neto, obtenerImpresoras()).total

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE ordenes
         SET estado = 'cobrada', descuento = ?, metodo_pago = 'credito', monto_recibido = NULL,
             cambio = 0, ticket_impreso = 1, cerrado_en = ?
       WHERE id = ?`
    ).run(desc, ahora(), ordenId)
    // Sin pagos: el cargo a crédito queda en la cuenta del cliente.
    db.prepare('DELETE FROM pagos WHERE orden_id = ?').run(ordenId)
    creditos.registrarCargo(clienteId, aPagar, ordenId)
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
  return obtenerConDetalle(ordenId)
}

/** Descarta una orden vacía (sin productos): la borra y libera la mesa. */
export function descartar(ordenId: number): void {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  if (orden.detalle.length > 0) return // seguridad: nunca borrar con productos
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM ordenes WHERE id = ?').run(ordenId)
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
}

/** Cancela una orden dejando registro de auditoría (motivo + usuario). */
export function cancelar(ordenId: number, motivo: string, usuario = 'caja'): void {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  const razon = motivo.trim()
  if (!razon) throw new Error('Se requiere un motivo para cancelar la orden')
  const tx = db.transaction(() => {
    db.prepare("UPDATE ordenes SET estado = 'cancelada', cerrado_en = ? WHERE id = ?").run(
      ahora(),
      ordenId
    )
    cancelaciones.registrar(ordenId, razon, usuario, orden.total)
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
}
