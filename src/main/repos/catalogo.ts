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
  // La columna impresora_id almacena el ROL ('cocina' | 'barra' | null).
  const rol = cat.rol ?? null
  if (cat.id != null) {
    db.prepare('UPDATE categorias SET nombre = ?, orden = ?, impresora_id = ? WHERE id = ?').run(
      cat.nombre.trim(),
      cat.orden,
      rol,
      cat.id
    )
    return obtenerCategoria(cat.id)
  }
  const r = db
    .prepare('INSERT INTO categorias (nombre, orden, impresora_id) VALUES (?, ?, ?)')
    .run(cat.nombre.trim(), cat.orden, rol)
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

/** Cantidad total vendida por producto (órdenes cobradas), para ordenar por popularidad. */
export function masVendidos(): { productoId: number; vendido: number }[] {
  return obtenerDb()
    .prepare(
      `SELECT d.producto_id AS productoId, COALESCE(SUM(d.cantidad), 0) AS vendido
         FROM detalle_ordenes d
         JOIN ordenes o ON o.id = d.orden_id
        WHERE o.estado = 'cobrada'
        GROUP BY d.producto_id`
    )
    .all() as { productoId: number; vendido: number }[]
}

// --- Modificadores (grupos reutilizables) ----------------------------------

function modsDeGrupo(grupoId: number): Modificador[] {
  const mods = obtenerDb()
    .prepare('SELECT * FROM modificadores WHERE grupo_id = ? ORDER BY id')
    .all(grupoId) as Record<string, unknown>[]
  return mods.map(aModificador)
}

/** Todos los grupos reutilizables con sus modificadores. */
export function listarGrupos(): GrupoModificador[] {
  const grupos = obtenerDb()
    .prepare('SELECT * FROM grupos_modificadores ORDER BY nombre')
    .all() as Record<string, unknown>[]
  return grupos.map((g) => aGrupo(g, modsDeGrupo(g.id as number)))
}

/** Grupos asignados a un producto, en su orden. */
export function gruposDeProducto(productoId: number): GrupoModificador[] {
  const grupos = obtenerDb()
    .prepare(
      `SELECT g.*, pg.orden AS orden
         FROM grupos_modificadores g
         JOIN producto_grupos pg ON pg.grupo_id = g.id
        WHERE pg.producto_id = ?
        ORDER BY pg.orden, g.id`
    )
    .all(productoId) as Record<string, unknown>[]
  return grupos.map((g) => aGrupo(g, modsDeGrupo(g.id as number)))
}

export function guardarGrupo(g: GrupoInput): GrupoModificador {
  const db = obtenerDb()
  const obligatorio = g.obligatorio ? 1 : 0
  const multiple = g.multiple ? 1 : 0
  let grupoId: number
  if (g.id != null) {
    db.prepare(
      'UPDATE grupos_modificadores SET nombre = ?, obligatorio = ?, multiple = ? WHERE id = ?'
    ).run(g.nombre.trim(), obligatorio, multiple, g.id)
    grupoId = g.id
  } else {
    const r = db
      .prepare('INSERT INTO grupos_modificadores (nombre, obligatorio, multiple) VALUES (?, ?, ?)')
      .run(g.nombre.trim(), obligatorio, multiple)
    grupoId = Number(r.lastInsertRowid)
  }
  const fila = db.prepare('SELECT * FROM grupos_modificadores WHERE id = ?').get(grupoId) as Record<
    string,
    unknown
  >
  return aGrupo(fila, modsDeGrupo(grupoId))
}

export function eliminarGrupo(id: number): void {
  obtenerDb().prepare('DELETE FROM grupos_modificadores WHERE id = ?').run(id)
}

/** Asigna un grupo a un producto (al final del orden). */
export function asignarGrupo(productoId: number, grupoId: number): void {
  const db = obtenerDb()
  const max = db
    .prepare('SELECT COALESCE(MAX(orden), 0) AS n FROM producto_grupos WHERE producto_id = ?')
    .get(productoId) as { n: number }
  db.prepare(
    'INSERT OR IGNORE INTO producto_grupos (producto_id, grupo_id, orden) VALUES (?, ?, ?)'
  ).run(productoId, grupoId, max.n + 1)
}

export function desasignarGrupo(productoId: number, grupoId: number): void {
  obtenerDb()
    .prepare('DELETE FROM producto_grupos WHERE producto_id = ? AND grupo_id = ?')
    .run(productoId, grupoId)
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
  const controla = prod.controlarStock ? 1 : 0
  const stock = prod.stock || 0
  const minimo = Math.max(0, prod.stockMinimo || 0)
  const costo = Math.max(0, prod.costo || 0)
  if (prod.id != null) {
    db.prepare(
      `UPDATE productos
         SET nombre = ?, precio = ?, categoria_id = ?, activo = ?, descripcion = ?,
             controlar_stock = ?, stock = ?, stock_minimo = ?, costo = ?
       WHERE id = ?`
    ).run(
      prod.nombre.trim(),
      prod.precio,
      prod.categoriaId,
      activo,
      prod.descripcion ?? null,
      controla,
      stock,
      minimo,
      costo,
      prod.id
    )
    return obtenerProducto(prod.id)
  }
  const r = db
    .prepare(
      `INSERT INTO productos (nombre, precio, categoria_id, activo, descripcion, controlar_stock, stock, stock_minimo, costo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(prod.nombre.trim(), prod.precio, prod.categoriaId, activo, prod.descripcion ?? null, controla, stock, minimo, costo)
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
