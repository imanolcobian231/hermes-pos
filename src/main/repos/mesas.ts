import type { EstadoMesa, Mesa, MesaInput } from '@shared/types'
import { obtenerDb } from '../db'
import { aMesa } from '../db/mapeo'

export function listar(): Mesa[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM mesas ORDER BY numero')
    .all() as Record<string, unknown>[]
  return filas.map(aMesa)
}

export function crear(capacidad = 4): Mesa {
  const db = obtenerDb()
  const max = db.prepare('SELECT COALESCE(MAX(numero), 0) AS n FROM mesas').get() as { n: number }
  const numero = max.n + 1
  const r = db
    .prepare('INSERT INTO mesas (numero, nombre, capacidad, estado) VALUES (?, ?, ?, ?)')
    .run(numero, `Mesa ${numero}`, capacidad, 'libre')
  return obtener(Number(r.lastInsertRowid))
}

export function editar(id: number, datos: MesaInput): Mesa {
  const db = obtenerDb()
  const actual = obtener(id)
  const nombre = datos.nombre.trim() || `Mesa ${actual.numero}`
  db.prepare('UPDATE mesas SET nombre = ?, capacidad = ?, color = ? WHERE id = ?').run(
    nombre,
    Math.max(1, datos.capacidad),
    datos.color ?? null,
    id
  )
  return obtener(id)
}

export function eliminar(id: number): void {
  const db = obtenerDb()
  // No se puede borrar una mesa con una orden abierta en curso.
  const abierta = db
    .prepare("SELECT 1 FROM ordenes WHERE mesa_id = ? AND estado = 'abierta' LIMIT 1")
    .get(id)
  if (abierta) throw new Error('La mesa tiene una orden abierta; ciérrala antes de eliminarla')

  const tx = db.transaction(() => {
    // Desvincula las órdenes históricas (cobradas/canceladas) de la mesa para no
    // romper la referencia (FOREIGN KEY). Conservan todos sus datos; solo pierden
    // el vínculo con la mesa que se elimina.
    db.prepare('UPDATE ordenes SET mesa_id = NULL WHERE mesa_id = ?').run(id)
    db.prepare('DELETE FROM mesas WHERE id = ?').run(id)
  })
  tx()
}

export function cambiarEstado(id: number, estado: EstadoMesa): void {
  obtenerDb().prepare('UPDATE mesas SET estado = ? WHERE id = ?').run(estado, id)
}

export function obtener(id: number): Mesa {
  const fila = obtenerDb().prepare('SELECT * FROM mesas WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!fila) throw new Error(`Mesa ${id} no encontrada`)
  return aMesa(fila)
}
