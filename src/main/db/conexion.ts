import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

/** Devuelve la conexión SQLite (singleton). La crea si no existe. */
export function obtenerDb(): Database.Database {
  if (db) return db

  // En desarrollo guarda la DB junto a userData para no perder datos entre recargas.
  const ruta = join(app.getPath('userData'), 'hermes.db')
  db = new Database(ruta)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function cerrarDb(): void {
  db?.close()
  db = null
}
