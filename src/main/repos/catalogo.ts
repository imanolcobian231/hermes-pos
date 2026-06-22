import type {
  Categoria,
  CategoriaInput,
  GrupoInput,
  GrupoModificador,
  Modificador,
  ModificadorInput,
  Producto,
  ProductoInput
} from '@shared/types'
import { obtenerDb } from '../db'
import { aCategoria, aGrupo, aModificador, aProducto } from '../db/mapeo'

// --- Categorías ------------------------------------------------------------

export function listarCategorias(): Categoria[] {
  const filas = obtenerDb()
    .prepare('SELECT * FROM categorias ORDER BY orden, id')
    .all() as Record<string, unknown>[]
  return filas.map(aCategoria)
}

export function guardarCategoria(cat: CategoriaInput): Categoria {
  const db = obtenerDb()
  if (cat.id != null) {
    db.prepare('UPDATE categorias SET nombre = ?, orden = ? WHERE id = ?').run(
      cat.nombre.trim(),
      cat.orden,
      cat.id
    )
    return obtenerCategoria(cat.id)
  }
  const r = db
    .prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)')
    .run(cat.nombre.trim(), cat.orden)
  return obtenerCategoria(Number(r.lastInsertRowid))
}

export function eliminarCategoria(id: number): void {
  const db = obtenerDb()
  const usados = db
    .prepare('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?')
    .get(id) as { n: number }
  if (usados.n > 0) {
    throw new Error('No se puede eliminar: la categoría tiene productos asociados')
  }
  db.prepare('DELETE FROM categorias WHERE id = ?').run(id)
}

function obtenerCategoria(id: number): Categoria {
  const fila = obtenerDb().prepare('SELECT * FROM categorias WHERE id = ?').get(id) as Record<
    string,
    unknown
  >
  return aCategoria(fila)
}

// --- Productos -------------------------------------------------------------

export function listarProductos(): Producto[] {
  const db = obtenerDb()
  const filas = db.prepare('SELECT * FROM productos ORDER BY nombre').all() as Record<
    string,
    unknown
  >[]
  return filas.map((f) => ({ ...aProducto(f), grupos: gruposDeProducto(f.id as number) }))
}

// --- Modificadores ---------------------------------------------------------

export function gruposDeProducto(productoId: number): GrupoModificador[] {
  const db = obtenerDb()
  const grupos = db
    .prepare('SELECT * FROM grupos_modificadores WHERE producto_id = ? ORDER BY orden, id')
    .all(productoId) as Record<string, unknown>[]
  return grupos.map((g) => {
    const mods = db
      .prepare('SELECT * FROM modificadores WHERE grupo_id = ? ORDER BY id')
      .all(g.id) as Record<string, unknown>[]
    return aGrupo(g, mods.map(aModificador))
  })
}

export function guardarGrupo(g: GrupoInput): GrupoModificador {
  const db = obtenerDb()
  const obligatorio = g.obligatorio ? 1 : 0
  const multiple = g.multiple ? 1 : 0
  let grupoId: number
  if (g.id != null) {
    db.prepare(
      'UPDATE grupos_modificadores SET nombre = ?, obligatorio = ?, multiple = ?, orden = ? WHERE id = ?'
    ).run(g.nombre.trim(), obligatorio, multiple, g.orden, g.id)
    grupoId = g.id
  } else {
    const r = db
      .prepare(
        'INSERT INTO grupos_modificadores (producto_id, nombre, obligatorio, multiple, orden) VALUES (?, ?, ?, ?, ?)'
      )
      .run(g.productoId, g.nombre.trim(), obligatorio, multiple, g.orden)
    grupoId = Number(r.lastInsertRowid)
  }
  const fila = db.prepare('SELECT * FROM grupos_modificadores WHERE id = ?').get(grupoId) as Record<
    string,
    unknown
  >
  const mods = db
    .prepare('SELECT * FROM modificadores WHERE grupo_id = ? ORDER BY id')
    .all(grupoId) as Record<string, unknown>[]
  return aGrupo(fila, mods.map(aModificador))
}

export function eliminarGrupo(id: number): void {
  obtenerDb().prepare('DELETE FROM grupos_modificadores WHERE id = ?').run(id)
}

export function guardarModificador(m: ModificadorInput): Modificador {
  const db = obtenerDb()
  let modId: number
  if (m.id != null) {
    db.prepare('UPDATE modificadores SET nombre = ?, precio = ? WHERE id = ?').run(
      m.nombre.trim(),
      m.precio,
      m.id
    )
    modId = m.id
  } else {
    const r = db
      .prepare('INSERT INTO modificadores (grupo_id, nombre, precio) VALUES (?, ?, ?)')
      .run(m.grupoId, m.nombre.trim(), m.precio)
    modId = Number(r.lastInsertRowid)
  }
  const fila = db.prepare('SELECT * FROM modificadores WHERE id = ?').get(modId) as Record<
    string,
    unknown
  >
  return aModificador(fila)
}

export function eliminarModificador(id: number): void {
  obtenerDb().prepare('DELETE FROM modificadores WHERE id = ?').run(id)
}

export function guardarProducto(prod: ProductoInput): Producto {
  const db = obtenerDb()
  const activo = prod.activo ? 1 : 0
  if (prod.id != null) {
    db.prepare(
      'UPDATE productos SET nombre = ?, precio = ?, categoria_id = ?, activo = ?, descripcion = ? WHERE id = ?'
    ).run(prod.nombre.trim(), prod.precio, prod.categoriaId, activo, prod.descripcion ?? null, prod.id)
    return obtenerProducto(prod.id)
  }
  const r = db
    .prepare(
      'INSERT INTO productos (nombre, precio, categoria_id, activo, descripcion) VALUES (?, ?, ?, ?, ?)'
    )
    .run(prod.nombre.trim(), prod.precio, prod.categoriaId, activo, prod.descripcion ?? null)
  return obtenerProducto(Number(r.lastInsertRowid))
}

export function eliminarProducto(id: number): void {
  obtenerDb().prepare('DELETE FROM productos WHERE id = ?').run(id)
}

function obtenerProducto(id: number): Producto {
  const fila = obtenerDb().prepare('SELECT * FROM productos WHERE id = ?').get(id) as Record<
    string,
    unknown
  >
  return aProducto(fila)
}
