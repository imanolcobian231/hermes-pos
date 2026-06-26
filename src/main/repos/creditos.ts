import type { Cliente, ClienteInput, MetodoPago, MovimientoCredito, VentasPorMetodo } from '@shared/types'
import { obtenerDb } from '../db'
import { aCliente, aMovimientoCredito } from '../db/mapeo'

// Créditos (fiados): clientes y su saldo, cargos (al fiar una orden) y abonos
// (pagos del cliente). El saldo es SUM(cargos) − SUM(abonos).

const ahora = (): string => new Date().toISOString()

// Subconsulta que calcula el saldo de cada cliente a partir de sus movimientos.
const SALDO_SQL = `
  COALESCE((
    SELECT SUM(CASE WHEN m.tipo = 'cargo' THEN m.monto ELSE -m.monto END)
    FROM movimientos_credito m WHERE m.cliente_id = c.id
  ), 0) AS saldo`

/** Lista los clientes activos con su saldo; los que deben primero. */
export function listarClientes(): Cliente[] {
  const filas = obtenerDb()
    .prepare(`SELECT c.*, ${SALDO_SQL} FROM clientes c WHERE c.activo = 1 ORDER BY saldo DESC, c.nombre`)
    .all() as Record<string, unknown>[]
  return filas.map(aCliente)
}

export function obtenerCliente(id: number): Cliente {
  const fila = obtenerDb()
    .prepare(`SELECT c.*, ${SALDO_SQL} FROM clientes c WHERE c.id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!fila) throw new Error(`Cliente ${id} no encontrado`)
  return aCliente(fila)
}

export function guardarCliente(input: ClienteInput): Cliente {
  const db = obtenerDb()
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('El nombre del cliente es obligatorio')
  const telefono = input.telefono?.trim() || null
  const nota = input.nota?.trim() || null
  if (input.id) {
    db.prepare('UPDATE clientes SET nombre = ?, telefono = ?, nota = ? WHERE id = ?').run(
      nombre,
      telefono,
      nota,
      input.id
    )
    return obtenerCliente(input.id)
  }
  const r = db
    .prepare('INSERT INTO clientes (nombre, telefono, nota, activo) VALUES (?, ?, ?, 1)')
    .run(nombre, telefono, nota)
  return obtenerCliente(Number(r.lastInsertRowid))
}

/** Desactiva un cliente. Solo si no debe nada (saldo 0). */
export function eliminarCliente(id: number): void {
  const cliente = obtenerCliente(id)
  if (Math.abs(cliente.saldo) >= 0.01) {
    throw new Error('No se puede eliminar un cliente con saldo pendiente')
  }
  obtenerDb().prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id)
}

export function movimientosDe(clienteId: number): MovimientoCredito[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM movimientos_credito WHERE cliente_id = ? ORDER BY creado_en DESC, id DESC')
    .all(clienteId) as Record<string, unknown>[]
  return filas.map(aMovimientoCredito)
}

/** Registra un cargo (fiado) en la cuenta del cliente. Lo llama ordenes.fiar. */
export function registrarCargo(clienteId: number, monto: number, ordenId: number): void {
  obtenerDb()
    .prepare(
      `INSERT INTO movimientos_credito (cliente_id, tipo, monto, orden_id, creado_en)
       VALUES (?, 'cargo', ?, ?, ?)`
    )
    .run(clienteId, monto, ordenId, ahora())
}

/** Revierte el cargo de una orden (al devolver una venta fiada). */
export function revertirCargoDeOrden(ordenId: number): void {
  obtenerDb()
    .prepare("DELETE FROM movimientos_credito WHERE orden_id = ? AND tipo = 'cargo'")
    .run(ordenId)
}

/** Registra un abono (pago del cliente a su deuda). */
export function registrarAbono(
  clienteId: number,
  monto: number,
  metodo: MetodoPago,
  nota?: string
): Cliente {
  if (monto <= 0) throw new Error('El abono debe ser mayor a cero')
  obtenerDb()
    .prepare(
      `INSERT INTO movimientos_credito (cliente_id, tipo, monto, metodo, nota, creado_en)
       VALUES (?, 'abono', ?, ?, ?, ?)`
    )
    .run(clienteId, monto, metodo, nota?.trim() || null, ahora())
  return obtenerCliente(clienteId)
}

/** Totales de abonos del turno (no archivados) por método, para el corte. */
export function abonosTurnoPorMetodo(): VentasPorMetodo {
  return obtenerDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN metodo = 'efectivo'      THEN monto ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN metodo = 'tarjeta'       THEN monto ELSE 0 END), 0) AS tarjeta,
         COALESCE(SUM(CASE WHEN metodo = 'transferencia' THEN monto ELSE 0 END), 0) AS transferencia
       FROM movimientos_credito
       WHERE tipo = 'abono' AND corte_id IS NULL`
    )
    .get() as VentasPorMetodo
}

/** Marca los abonos del turno como pertenecientes a un corte (al cerrarlo). */
export function archivarAbonos(corteId: number): void {
  obtenerDb()
    .prepare("UPDATE movimientos_credito SET corte_id = ? WHERE tipo = 'abono' AND corte_id IS NULL")
    .run(corteId)
}
