import type Database from 'better-sqlite3'

// La app arranca sin datos de ejemplo (sin mesas ni productos demo). Lo único
// que se crea es una categoría "Todos" por defecto, para que se puedan agregar
// productos de inmediato sin tener que crear una categoría primero. Cada negocio
// define sus propias mesas, categorías, productos y usuarios.
//
// En la primera ejecución, si no hay usuarios, la pantalla de inicio pide
// configurar el primer PIN de admin.
export function sembrarDatos(db: Database.Database): void {
  const hayCategorias = db.prepare('SELECT COUNT(*) AS n FROM categorias').get() as { n: number }
  if (hayCategorias.n === 0) {
    db.prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)').run('Todos', 1)
  }
}
