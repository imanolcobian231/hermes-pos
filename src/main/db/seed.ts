import type Database from 'better-sqlite3'

// Datos iniciales: solo se siembran si las tablas están vacías.

const CATEGORIAS: [string, number][] = [
  ['Tacos', 1],
  ['Quesadillas', 2],
  ['Bebidas', 3],
  ['Postres', 4]
]

// [nombre, precio, ordenCategoria, activo]
const PRODUCTOS: [string, number, number, number][] = [
  ['Taco al pastor', 25, 1, 1],
  ['Taco de bistec', 28, 1, 1],
  ['Taco de suadero', 27, 1, 1],
  ['Taco de campechano', 30, 1, 1],
  ['Gringa', 65, 2, 1],
  ['Quesadilla sencilla', 45, 2, 1],
  ['Vuelve a la vida', 55, 2, 0],
  ['Refresco', 25, 3, 1],
  ['Agua de horchata', 30, 3, 1],
  ['Cerveza', 45, 3, 1],
  ['Flan', 35, 4, 1],
  ['Arroz con leche', 30, 4, 1]
]

export function sembrarDatos(db: Database.Database): void {
  const hayMesas = db.prepare('SELECT COUNT(*) AS n FROM mesas').get() as { n: number }
  if (hayMesas.n === 0) {
    const insMesa = db.prepare(
      'INSERT INTO mesas (numero, nombre, capacidad, estado) VALUES (?, ?, ?, ?)'
    )
    const capacidades = [2, 4, 6, 8]
    const sembrarMesas = db.transaction(() => {
      for (let i = 1; i <= 12; i++) {
        insMesa.run(i, `Mesa ${i}`, capacidades[(i - 1) % 4], 'libre')
      }
    })
    sembrarMesas()
  }

  const hayCategorias = db.prepare('SELECT COUNT(*) AS n FROM categorias').get() as { n: number }
  if (hayCategorias.n === 0) {
    const insCat = db.prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)')
    const insProd = db.prepare(
      'INSERT INTO productos (nombre, precio, categoria_id, activo) VALUES (?, ?, ?, ?)'
    )
    const sembrarCatalogo = db.transaction(() => {
      const idsPorOrden = new Map<number, number>()
      for (const [nombre, orden] of CATEGORIAS) {
        const r = insCat.run(nombre, orden)
        idsPorOrden.set(orden, Number(r.lastInsertRowid))
      }
      for (const [nombre, precio, ordenCat, activo] of PRODUCTOS) {
        insProd.run(nombre, precio, idsPorOrden.get(ordenCat), activo)
      }
    })
    sembrarCatalogo()
  }
}
