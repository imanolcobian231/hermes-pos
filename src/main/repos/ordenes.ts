import type { DetalleOrden, MetodoPago, MetodoPagoOrden, OrdenConDetalle, Pago } from '@shared/types'
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

/**
 * Historial de tickets (órdenes ya cobradas) de una mesa, recientes primero.
 * Sirve para reimprimir tickets anteriores desde la pantalla de mesas.
 */
export function historialMesa(mesaId: number, limite = 40): OrdenConDetalle[] {
  const filas = obtenerDb()
    .prepare(
      "SELECT * FROM ordenes WHERE mesa_id = ? AND estado = 'cobrada' ORDER BY cerrado_en DESC LIMIT ?"
    )
    .all(mesaId, limite) as Record<string, unknown>[]
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

/** Lanza error si la orden no existe o ya no está abierta (no se puede editar). */
function exigirOrdenAbierta(ordenId: number): void {
  const r = obtenerDb().prepare('SELECT estado FROM ordenes WHERE id = ?').get(ordenId) as
    | { estado: string }
    | undefined
  if (!r) throw new Error(`Orden ${ordenId} no encontrada`)
  if (r.estado !== 'abierta') throw new Error('La orden ya fue cerrada; no se puede modificar')
}

function recalcularTotal(ordenId: number): void {
  // El total resta el descuento por línea (nunca deja una línea en negativo).
  obtenerDb()
    .prepare(
      `UPDATE ordenes SET total = (
         SELECT COALESCE(SUM(MAX(cantidad * precio_unitario - descuento, 0)), 0)
         FROM detalle_ordenes WHERE orden_id = ?
       ) WHERE id = ?`
    )
    .run(ordenId, ordenId)
}

/**
 * Fija el descuento (monto en pesos) de una línea del carrito, sin afectar las
 * demás. Se acota al importe de la línea y recalcula el total de la orden.
 */
export function fijarDescuentoLinea(detalleId: number, descuento: number): OrdenConDetalle {
  const db = obtenerDb()
  const linea = db
    .prepare('SELECT orden_id, cantidad, precio_unitario FROM detalle_ordenes WHERE id = ?')
    .get(detalleId) as { orden_id: number; cantidad: number; precio_unitario: number } | undefined
  if (!linea) throw new Error(`Línea ${detalleId} no encontrada`)
  exigirOrdenAbierta(linea.orden_id)
  const importe = linea.cantidad * linea.precio_unitario
  const desc = Math.max(0, Math.min(descuento || 0, importe))
  db.prepare('UPDATE detalle_ordenes SET descuento = ? WHERE id = ?').run(desc, detalleId)
  recalcularTotal(linea.orden_id)
  return obtenerConDetalle(linea.orden_id)
}

/**
 * Lanza error si agregar `delta` unidades más de un producto a la orden supera
 * el stock disponible (stock del producto − lo que ya lleva la orden).
 */
function exigirStockDisponible(
  db: ReturnType<typeof obtenerDb>,
  ordenId: number,
  productoId: number,
  stock: number,
  delta: number
): void {
  if (delta <= 0) return
  const enCarrito = (
    db
      .prepare(
        'SELECT COALESCE(SUM(cantidad), 0) as total FROM detalle_ordenes WHERE orden_id = ? AND producto_id = ?'
      )
      .get(ordenId, productoId) as { total: number }
  ).total
  if (delta > stock - enCarrito) {
    throw new Error('No hay más existencia de este producto')
  }
}

/**
 * Ajusta el stock de los productos con control de inventario de una orden.
 * factor = -1 al vender (descuenta); +1 al devolver (repone). Solo afecta a los
 * productos con controlar_stock = 1.
 */
function ajustarStockProductos(db: ReturnType<typeof obtenerDb>, ordenId: number, factor: number): void {
  db.prepare(
    `UPDATE productos
       SET stock = MAX(0, stock + ? * (
         SELECT COALESCE(SUM(cantidad), 0) FROM detalle_ordenes
         WHERE orden_id = ? AND producto_id = productos.id
       ))
     WHERE controlar_stock = 1
       AND id IN (SELECT producto_id FROM detalle_ordenes WHERE orden_id = ?)`
  ).run(factor, ordenId, ordenId)

  // Registra el movimiento por producto: 'salida' al vender, 'entrada' al devolver.
  const tipo = factor < 0 ? 'salida' : 'entrada'
  const nota = factor < 0 ? `Venta orden #${ordenId}` : `Devolución orden #${ordenId}`
  db.prepare(
    `INSERT INTO movimientos_producto (producto_id, tipo, cantidad, nota, usuario, creado_en)
     SELECT d.producto_id, ?, SUM(d.cantidad), ?, 'caja', ?
       FROM detalle_ordenes d
       JOIN productos p ON p.id = d.producto_id
      WHERE d.orden_id = ? AND p.controlar_stock = 1
      GROUP BY d.producto_id`
  ).run(tipo, nota, ahora(), ordenId)
}

/**
 * Descuenta (o repone) los INSUMOS que consumen los productos de una orden según
 * su receta. Consumo por insumo = Σ (cantidad vendida × cantidad de la receta).
 * factor = -1 al vender (descuenta); +1 al devolver (repone).
 */
function ajustarInsumosReceta(db: ReturnType<typeof obtenerDb>, ordenId: number, factor: number): void {
  db.prepare(
    `UPDATE insumos
       SET stock = ROUND(stock + ? * (
         SELECT COALESCE(SUM(d.cantidad * pi.cantidad), 0)
           FROM detalle_ordenes d
           JOIN producto_insumos pi ON pi.producto_id = d.producto_id
          WHERE d.orden_id = ? AND pi.insumo_id = insumos.id
       ), 3)
     WHERE id IN (
       SELECT pi.insumo_id FROM detalle_ordenes d
         JOIN producto_insumos pi ON pi.producto_id = d.producto_id
        WHERE d.orden_id = ?
     )`
  ).run(factor, ordenId, ordenId)

  // Registra el consumo en el historial de cada insumo.
  const tipo = factor < 0 ? 'salida' : 'entrada'
  const nota = factor < 0 ? `Receta orden #${ordenId}` : `Devolución orden #${ordenId}`
  db.prepare(
    `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, nota, usuario, creado_en)
     SELECT pi.insumo_id, ?, SUM(d.cantidad * pi.cantidad), ?, 'caja', ?
       FROM detalle_ordenes d
       JOIN producto_insumos pi ON pi.producto_id = d.producto_id
      WHERE d.orden_id = ?
      GROUP BY pi.insumo_id`
  ).run(tipo, nota, ahora(), ordenId)
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
export function abrirLlevar(nombre?: string): OrdenConDetalle {
  const db = obtenerDb()
  const previas = db.prepare('SELECT COUNT(*) AS n FROM ordenes WHERE para_llevar = 1').get() as {
    n: number
  }
  const limpio = nombre?.trim()
  // En modo tiendita es una venta directa (sin mesas ni "para llevar").
  const base = obtenerImpresoras().modoTiendita === true ? 'Venta' : 'Para llevar'
  const nom = limpio && limpio.length > 0 ? limpio : `${base} #${previas.n + 1}`
  const r = db
    .prepare(
      "INSERT INTO ordenes (mesa_id, para_llevar, nombre, estado, total, abierto_en) VALUES (NULL, 1, ?, 'abierta', 0, ?)"
    )
    .run(nom, ahora())
  return obtenerConDetalle(Number(r.lastInsertRowid))
}

export function agregarProducto(
  ordenId: number,
  productoId: number,
  modificadorIds: number[] = [],
  comensal = 1
): OrdenConDetalle {
  const db = obtenerDb()
  exigirOrdenAbierta(ordenId)
  const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(productoId) as
    | Record<string, unknown>
    | undefined
  if (!prod) throw new Error(`Producto ${productoId} no encontrado`)
  if (prod.controlar_stock === 1) {
    exigirStockDisponible(db, ordenId, productoId, prod.stock as number, 1)
  }

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

/**
 * Agrega una línea de "venta rápida / abierta": un producto NO registrado en el
 * catálogo, con nombre libre y precio a elección (ej. "$50 de frijoles"). No
 * afecta inventario ni recetas; usa producto_id = 0 (centinela, sin FK).
 */
export function agregarLineaLibre(
  ordenId: number,
  nombre: string,
  precio: number,
  comensal = 1
): OrdenConDetalle {
  const db = obtenerDb()
  exigirOrdenAbierta(ordenId)
  const nom = nombre.trim() || 'Venta rápida'
  const p = Math.max(0, precio || 0)
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO detalle_ordenes
         (orden_id, producto_id, nombre_producto, cantidad, precio_unitario, comensal, enviado_cocina)
       VALUES (?, 0, ?, 1, ?, ?, 0)`
    ).run(ordenId, nom, p, Math.max(1, comensal))
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
  exigirOrdenAbierta(ordenId)
  const linea = db.prepare('SELECT * FROM detalle_ordenes WHERE id = ?').get(detalleId) as
    | Record<string, unknown>
    | undefined
  if (linea) {
    if (delta > 0) {
      const prod = db
        .prepare('SELECT controlar_stock, stock FROM productos WHERE id = ?')
        .get(linea.producto_id) as { controlar_stock: number; stock: number } | undefined
      if (prod?.controlar_stock === 1) {
        exigirStockDisponible(db, ordenId, linea.producto_id as number, prod.stock, delta)
      }
    }
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

/** Fija la nota libre del ticket a nivel orden (se imprime en el ticket). */
export function fijarNotaOrden(ordenId: number, nota: string): OrdenConDetalle {
  obtenerDb()
    .prepare('UPDATE ordenes SET nota = ? WHERE id = ?')
    .run(nota.trim() || null, ordenId)
  return obtenerConDetalle(ordenId)
}

export function quitarLinea(ordenId: number, detalleId: number): OrdenConDetalle {
  const db = obtenerDb()
  exigirOrdenAbierta(ordenId)
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
  descuento = 0,
  propina = 0
): OrdenConDetalle {
  const db = obtenerDb()
  const orden = obtenerConDetalle(ordenId)
  // Guarda contra doble cobro (ej. doble clic): solo se cobra una orden abierta.
  if (orden.estado !== 'abierta') throw new Error('Esta orden ya fue cerrada')
  const desc = Math.max(0, Math.min(descuento, orden.total)) // no mayor al subtotal
  const prop = Math.max(0, propina || 0)

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
         SET estado = 'cobrada', descuento = ?, propina = ?, metodo_pago = ?, monto_recibido = ?, cambio = ?,
             ticket_impreso = 1, cerrado_en = ?
       WHERE id = ?`
    ).run(desc, prop, metodoGuardado, recibido, cambio, ahora(), ordenId)
    // Reemplaza los pagos (por si se recobra) y registra el desglose.
    db.prepare('DELETE FROM pagos WHERE orden_id = ?').run(ordenId)
    const ins = db.prepare('INSERT INTO pagos (orden_id, metodo, monto) VALUES (?, ?, ?)')
    for (const p of limpios) ins.run(ordenId, p.metodo, p.monto)
    ajustarStockProductos(db, ordenId, -1) // descuenta inventario al vender
    ajustarInsumosReceta(db, ordenId, -1) // descuenta insumos de la receta
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
  return obtenerConDetalle(ordenId)
}

/**
 * Cambia el método de pago de una venta ya cobrada del turno actual. Útil en
 * modo restaurante, donde al cobrar se asume efectivo y luego, si el cliente
 * pagó con tarjeta/transferencia, se corrige aquí. Conserva el monto pagado
 * (reemplaza el desglose de pagos por uno solo en el nuevo método).
 */
export function cambiarMetodoPago(ordenId: number, metodo: MetodoPago): OrdenConDetalle {
  const db = obtenerDb()
  const fila = db
    .prepare('SELECT estado, corte_id, metodo_pago FROM ordenes WHERE id = ?')
    .get(ordenId) as { estado: string; corte_id: number | null; metodo_pago: string | null } | undefined
  if (!fila) throw new Error(`Orden ${ordenId} no encontrada`)
  if (fila.estado !== 'cobrada') throw new Error('Solo se puede cambiar el método de una venta cobrada')
  if (fila.corte_id != null) throw new Error('No se puede cambiar el método de una venta de un turno ya cerrado')
  if (fila.metodo_pago === 'credito') throw new Error('Una venta a crédito no cambia de método aquí')

  const tx = db.transaction(() => {
    const suma = (
      db.prepare('SELECT COALESCE(SUM(monto), 0) AS t FROM pagos WHERE orden_id = ?').get(ordenId) as {
        t: number
      }
    ).t
    db.prepare('DELETE FROM pagos WHERE orden_id = ?').run(ordenId)
    db.prepare('INSERT INTO pagos (orden_id, metodo, monto) VALUES (?, ?, ?)').run(ordenId, metodo, suma)
    const recibido = metodo === 'efectivo' ? suma : null
    db.prepare('UPDATE ordenes SET metodo_pago = ?, monto_recibido = ?, cambio = 0 WHERE id = ?').run(
      metodo,
      recibido,
      ordenId
    )
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
  // Guarda contra doble cargo (ej. doble clic): solo se fía una orden abierta.
  if (orden.estado !== 'abierta') throw new Error('Esta orden ya fue cerrada')
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
    ajustarStockProductos(db, ordenId, -1) // fiar también es venta: descuenta stock
    ajustarInsumosReceta(db, ordenId, -1) // descuenta insumos de la receta
    if (orden.mesaId != null) mesas.cambiarEstado(orden.mesaId, 'libre')
  })
  tx()
  return obtenerConDetalle(ordenId)
}

/**
 * Devuelve (revierte) una venta ya cobrada del turno actual: la marca como
 * 'devuelta' (sale de ingresos y reportes), revierte el cargo si fue fiada y
 * deja registro de auditoría. No aplica a ventas de turnos ya cerrados.
 */
export function devolver(ordenId: number, motivo: string, usuario = 'caja'): void {
  const db = obtenerDb()
  const fila = db
    .prepare('SELECT estado, corte_id, metodo_pago, total FROM ordenes WHERE id = ?')
    .get(ordenId) as
    | { estado: string; corte_id: number | null; metodo_pago: string | null; total: number }
    | undefined
  if (!fila) throw new Error(`Orden ${ordenId} no encontrada`)
  if (fila.estado !== 'cobrada') throw new Error('Solo se puede devolver una venta cobrada')
  if (fila.corte_id != null) throw new Error('No se puede devolver una venta de un turno ya cerrado')
  const razon = motivo.trim()
  if (!razon) throw new Error('Se requiere un motivo para la devolución')

  const tx = db.transaction(() => {
    db.prepare("UPDATE ordenes SET estado = 'devuelta' WHERE id = ?").run(ordenId)
    if (fila.metodo_pago === 'credito') creditos.revertirCargoDeOrden(ordenId)
    ajustarStockProductos(db, ordenId, 1) // devolución: repone el inventario vendido
    ajustarInsumosReceta(db, ordenId, 1) // repone los insumos de la receta
    cancelaciones.registrar(ordenId, `Devolución: ${razon}`, usuario, fila.total)
  })
  tx()
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
  // Solo se cancela una orden abierta; una venta ya cobrada se revierte con "devolver".
  if (orden.estado !== 'abierta') throw new Error('Esta orden ya fue cerrada; usa "devolver" si necesitas revertir una venta')
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
