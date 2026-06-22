import type Database from 'better-sqlite3'

// Migraciones idempotentes para bases ya existentes. Se ejecutan después de
// `crearEsquema` (que crea tablas nuevas con la forma final). Aquí se ajustan
// tablas viejas que CREATE TABLE IF NOT EXISTS no toca.

function columnas(db: Database.Database, tabla: string): string[] {
  return (db.prepare(`PRAGMA table_info('${tabla}')`).all() as { name: string }[]).map((c) => c.name)
}

// La tabla `ordenes` original tenía mesa_id NOT NULL y carecía de las columnas
// para_llevar / nombre / por_cobrar. Se reconstruye conservando los datos.
function reconstruirOrdenes(db: Database.Database): void {
  db.pragma('foreign_keys = OFF')
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE ordenes_new (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa_id        INTEGER REFERENCES mesas(id),
        para_llevar    INTEGER NOT NULL DEFAULT 0,
        nombre         TEXT,
        estado         TEXT    NOT NULL DEFAULT 'abierta',
        total          REAL    NOT NULL DEFAULT 0,
        descuento      REAL    NOT NULL DEFAULT 0,
        por_cobrar     INTEGER NOT NULL DEFAULT 0,
        metodo_pago    TEXT,
        monto_recibido REAL,
        cambio         REAL,
        ticket_impreso INTEGER NOT NULL DEFAULT 0,
        abierto_en     TEXT    NOT NULL,
        cerrado_en     TEXT,
        corte_id       INTEGER REFERENCES cortes(id)
      );
    `)
    db.exec(`
      INSERT INTO ordenes_new
        (id, mesa_id, estado, total, metodo_pago, monto_recibido, cambio,
         ticket_impreso, abierto_en, cerrado_en, corte_id)
      SELECT id, mesa_id, estado, total, metodo_pago, monto_recibido, cambio,
             ticket_impreso, abierto_en, cerrado_en, corte_id
      FROM ordenes;
    `)
    db.exec('DROP TABLE ordenes;')
    db.exec('ALTER TABLE ordenes_new RENAME TO ordenes;')
    db.exec('CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);')
  })
  tx()
  db.pragma('foreign_keys = ON')
}

export function migrar(db: Database.Database): void {
  const cols = columnas(db, 'ordenes')
  if (!cols.includes('para_llevar')) {
    reconstruirOrdenes(db)
  } else if (!cols.includes('descuento')) {
    // Migración aditiva: solo faltaba la columna de descuento.
    db.exec('ALTER TABLE ordenes ADD COLUMN descuento REAL NOT NULL DEFAULT 0')
  }
}
