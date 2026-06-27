import type {
  Insumo,
  InsumoInput,
  MovimientoInventario,
  ResumenInventario,
  TipoMovInventario
} from '@shared/types'
import { obtenerDb } from '../db'
import { aInsumo, aMovimientoInventario } from '../db/mapeo'

// Inventario de insumos. El stock se mantiene en la fila del insumo y cada
// cambio queda en movimientos_inventario para auditoría. (La descarga
// automática por receta es una fase posterior.)

const ahora = (): string => new Date().toISOString()

export function listarInsumos(): Insumo[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM insumos WHERE activo = 1 ORDER BY nombre')
    .all() as Record<string, unknown>[]
  return filas.map(aInsumo)
}

export function obtenerInsumo(id: number): Insumo {
  const fila = obtenerDb().prepare('SELECT * FROM insumos WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!fila) throw new Error(`Insumo ${id} no encontrado`)
  return aInsumo(fila)
}

export function guardarInsumo(input: InsumoInput): Insumo {
  const db = obtenerDb()
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('El nombre del insumo es obligatorio')
  const unidad = input.unidad.trim() || 'pieza'
  const minimo = Math.max(0, input.stockMinimo || 0)
  const costo = Math.max(0, input.costo || 0)
  if (input.id) {
    db.prepare('UPDATE insumos SET nombre = ?, unidad = ?, stock_minimo = ?, costo = ? WHERE id = ?').run(
      nombre,
      unidad,
      minimo,
      costo,
      input.id
    )
    return obtenerInsumo(input.id)
  }
  const r = db
    .prepare('INSERT INTO insumos (nombre, unidad, stock, stock_minimo, costo, activo) VALUES (?, ?, 0, ?, ?, 1)')
    .run(nombre, unidad, minimo, costo)
  return obtenerInsumo(Number(r.lastInsertRowid))
}

/** Desactiva un insumo (baja lógica para conservar el historial). */
export function eliminarInsumo(id: number): void {
  obtenerDb().prepare('UPDATE insumos SET activo = 0 WHERE id = ?').run(id)
}

/**
 * Registra un movimiento y actualiza el stock:
 * - entrada: suma; salida/merma: resta; ajuste: fija el stock al valor dado.
 */
export function registrarMovimiento(
  insumoId: number,
  tipo: TipoMovInventario,
  cantidad: number,
  nota: string | undefined,
  usuario = 'caja'
): Insumo {
  const db = obtenerDb()
  const insumo = obtenerInsumo(insumoId)
  const cant = Math.max(0, cantidad || 0)
  if (cant === 0 && tipo !== 'ajuste') throw new Error('La cantidad debe ser mayor a cero')

  let nuevoStock: number
  if (tipo === 'entrada') nuevoStock = insumo.stock + cant
  else if (tipo === 'salida' || tipo === 'merma') nuevoStock = insumo.stock - cant
  else nuevoStock = cant // ajuste: fija el stock contado
  nuevoStock = Math.round(nuevoStock * 1000) / 1000 // evita ruido de coma flotante

  const tx = db.transaction(() => {
    db.prepare('UPDATE insumos SET stock = ? WHERE id = ?').run(nuevoStock, insumoId)
    db.prepare(
      `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, nota, usuario, creado_en)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(insumoId, tipo, cant, nota?.trim() || null, usuario, ahora())
  })
  tx()
  return obtenerInsumo(insumoId)
}

export function movimientosDe(insumoId: number): MovimientoInventario[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM movimientos_inventario WHERE insumo_id = ? ORDER BY creado_en DESC, id DESC')
    .all(insumoId) as Record<string, unknown>[]
  return filas.map(aMovimientoInventario)
}

export function resumen(): ResumenInventario {
  const r = obtenerDb()
    .prepare(
      `SELECT
         COUNT(*) AS num,
         COALESCE(SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END), 0) AS bajo,
         COALESCE(SUM(stock * costo), 0) AS valor
       FROM insumos WHERE activo = 1`
    )
    .get() as { num: number; bajo: number; valor: number }
  return { numInsumos: r.num, bajoStock: r.bajo, valorTotal: r.valor }
}
