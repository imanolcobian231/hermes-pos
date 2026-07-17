import type {
  Categoria,
  CategoriaInput,
  ComboItem,
  FilaImportProducto,
  GrupoInput,
  GrupoModificador,
  Modificador,
  ModificadorInput,
  Producto,
  ProductoInput,
  RecetaItem,
  ResultadoImport
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
  return filas.map((f) => {
    const p = aProducto(f)
    return {
      ...p,
      grupos: gruposDeProducto(p.id),
      // Las partes del combo se incluyen para poder expandirlo en la comanda.
      comboItems: p.esCombo ? comboItems(p.id) : undefined
    }
  })
}

/** Importa productos en masa. La categoría se busca por nombre (se crea si no
 *  existe). Devuelve cuántos se crearon y los errores por fila. */
export function importarProductos(filas: FilaImportProducto[]): ResultadoImport {
  const db = obtenerDb()
  let creados = 0
  let categoriasNuevas = 0
  const errores: string[] = []
  const catPorNombre = new Map<string, number>()
  for (const c of db.prepare('SELECT id, nombre FROM categorias').all() as {
    id: number
    nombre: string
  }[]) {
    catPorNombre.set(c.nombre.trim().toLowerCase(), c.id)
  }
  const siguienteOrden = (): number =>
    ((db.prepare('SELECT COALESCE(MAX(orden), 0) AS m FROM categorias').get() as { m: number }).m || 0) + 1

  const insProd = db.prepare(
    `INSERT INTO productos (nombre, precio, categoria_id, activo, controlar_stock, stock, stock_minimo, costo, codigo_barras)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`
  )

  const tx = db.transaction(() => {
    filas.forEach((f, i) => {
      const fila = i + 2 // +2: encabezado + base 1
      const nombre = (f.nombre || '').trim()
      if (!nombre) {
        errores.push(`Fila ${fila}: sin nombre`)
        return
      }
      const catNombre = (f.categoria || '').trim()
      if (!catNombre) {
        errores.push(`Fila ${fila} (${nombre}): falta categoría`)
        return
      }
      let catId = catPorNombre.get(catNombre.toLowerCase())
      if (catId == null) {
        const r = db
          .prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)')
          .run(catNombre, siguienteOrden())
        catId = Number(r.lastInsertRowid)
        catPorNombre.set(catNombre.toLowerCase(), catId)
        categoriasNuevas++
      }
      insProd.run(
        nombre,
        Math.max(0, f.precio || 0),
        catId,
        f.controlarStock ? 1 : 0,
        Math.max(0, f.stock || 0),
        Math.max(0, f.stockMinimo || 0),
        Math.max(0, f.costo || 0),
        (f.codigoBarras || '').trim() || null
      )
      creados++
    })
  })
  tx()
  return { creados, categoriasNuevas, errores }
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
  // No se puede crear un producto sin una categoría válida.
  if (prod.categoriaId == null || Number.isNaN(prod.categoriaId)) {
    throw new Error('Crea una categoría antes de agregar productos')
  }
  const existeCat = db.prepare('SELECT 1 FROM categorias WHERE id = ?').get(prod.categoriaId)
  if (!existeCat) throw new Error('La categoría del producto no existe')
  const activo = prod.activo ? 1 : 0
  const controla = prod.controlarStock ? 1 : 0
  const stock = Math.max(0, prod.stock || 0)
  const minimo = Math.max(0, prod.stockMinimo || 0)
  const costo = Math.max(0, prod.costo || 0)
  const color = prod.color?.trim() || null
  const codigoBarras = prod.codigoBarras?.trim() || null
  const esCombo = prod.esCombo ? 1 : 0

  const tx = db.transaction(() => {
    let id: number
    if (prod.id != null) {
      db.prepare(
        `UPDATE productos
           SET nombre = ?, precio = ?, categoria_id = ?, activo = ?, descripcion = ?,
               controlar_stock = ?, stock = ?, stock_minimo = ?, costo = ?, color = ?, codigo_barras = ?, es_combo = ?
         WHERE id = ?`
      ).run(
        prod.nombre.trim(), prod.precio, prod.categoriaId, activo, prod.descripcion ?? null,
        controla, stock, minimo, costo, color, codigoBarras, esCombo, prod.id
      )
      id = prod.id
    } else {
      const r = db
        .prepare(
          `INSERT INTO productos (nombre, precio, categoria_id, activo, descripcion, controlar_stock, stock, stock_minimo, costo, color, codigo_barras, es_combo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(prod.nombre.trim(), prod.precio, prod.categoriaId, activo, prod.descripcion ?? null, controla, stock, minimo, costo, color, codigoBarras, esCombo)
      id = Number(r.lastInsertRowid)
    }
    // Reemplaza las partes del combo (borra y reinserta).
    db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(id)
    if (esCombo && prod.comboItems && prod.comboItems.length > 0) {
      const ins = db.prepare(
        'INSERT INTO combo_items (combo_id, producto_id, cantidad) VALUES (?, ?, ?)'
      )
      for (const it of prod.comboItems) {
        if (it.productoId && it.productoId !== id) ins.run(id, it.productoId, Math.max(1, it.cantidad || 1))
      }
    }
    // Reemplaza la receta (insumos que consume el producto al venderse).
    db.prepare('DELETE FROM producto_insumos WHERE producto_id = ?').run(id)
    if (prod.receta && prod.receta.length > 0) {
      const insR = db.prepare(
        'INSERT OR REPLACE INTO producto_insumos (producto_id, insumo_id, cantidad) VALUES (?, ?, ?)'
      )
      for (const it of prod.receta) {
        if (it.insumoId && it.cantidad > 0) insR.run(id, it.insumoId, it.cantidad)
      }
    }
    return id
  })
  return obtenerProducto(tx())
}

/** Receta de un producto: insumos que consume + cantidad, con nombre y unidad. */
export function receta(productoId: number): RecetaItem[] {
  return obtenerDb()
    .prepare(
      `SELECT pi.insumo_id AS insumoId, pi.cantidad AS cantidad, i.nombre AS nombre, i.unidad AS unidad
         FROM producto_insumos pi JOIN insumos i ON i.id = pi.insumo_id
        WHERE pi.producto_id = ? ORDER BY i.nombre`
    )
    .all(productoId) as RecetaItem[]
}

/** Partes de un combo (producto + cantidad), con el nombre de cada parte. */
export function comboItems(comboId: number): ComboItem[] {
  return obtenerDb()
    .prepare(
      `SELECT ci.producto_id AS productoId, ci.cantidad AS cantidad, p.nombre AS nombre
         FROM combo_items ci JOIN productos p ON p.id = ci.producto_id
        WHERE ci.combo_id = ? ORDER BY ci.id`
    )
    .all(comboId) as ComboItem[]
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
