import type Database from 'better-sqlite3'

// Esquema de Hermes POS — 7 tablas.
// Nota: SQLite no tiene boolean real; los flags se guardan como INTEGER 0/1
// (activo, ticket_impreso, enviado_cocina).

const DDL = `
CREATE TABLE IF NOT EXISTS mesas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  numero    INTEGER NOT NULL UNIQUE,
  nombre    TEXT    NOT NULL,
  capacidad INTEGER NOT NULL DEFAULT 4,
  estado    TEXT    NOT NULL DEFAULT 'libre',
  color     TEXT
);

CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL,
  orden  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS productos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT    NOT NULL,
  precio       REAL    NOT NULL DEFAULT 0,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  activo       INTEGER NOT NULL DEFAULT 1,
  descripcion  TEXT
);

CREATE TABLE IF NOT EXISTS ordenes (
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

CREATE TABLE IF NOT EXISTS detalle_ordenes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_id        INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL,
  nombre_producto TEXT    NOT NULL,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario REAL    NOT NULL DEFAULT 0,
  notas           TEXT,
  comensal        INTEGER NOT NULL DEFAULT 1,
  enviado_cocina  INTEGER NOT NULL DEFAULT 0,
  enviado_en      TEXT
);

CREATE TABLE IF NOT EXISTS grupos_modificadores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  obligatorio INTEGER NOT NULL DEFAULT 0,
  multiple    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS modificadores (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  nombre   TEXT    NOT NULL,
  precio   REAL    NOT NULL DEFAULT 0
);

-- Asignación de grupos reutilizables a productos (muchos a muchos).
CREATE TABLE IF NOT EXISTS producto_grupos (
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  grupo_id    INTEGER NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (producto_id, grupo_id)
);

CREATE TABLE IF NOT EXISTS detalle_modificadores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  detalle_id     INTEGER NOT NULL REFERENCES detalle_ordenes(id) ON DELETE CASCADE,
  modificador_id INTEGER,
  nombre         TEXT    NOT NULL,
  precio         REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cortes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha               TEXT NOT NULL,
  total_efectivo      REAL NOT NULL DEFAULT 0,
  total_tarjeta       REAL NOT NULL DEFAULT 0,
  total_transferencia REAL NOT NULL DEFAULT 0,
  total_gastos        REAL NOT NULL DEFAULT 0,
  num_ordenes         INTEGER NOT NULL DEFAULT 0,
  cerrado_en          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gastos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto TEXT    NOT NULL,
  monto    REAL    NOT NULL DEFAULT 0,
  fecha    TEXT    NOT NULL,
  corte_id INTEGER REFERENCES cortes(id)
);

CREATE TABLE IF NOT EXISTS reimpresiones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo          TEXT    NOT NULL,
  orden_id      INTEGER NOT NULL,
  usuario       TEXT    NOT NULL DEFAULT 'caja',
  reimprimir_en TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_orden ON detalle_ordenes(orden_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_modificadores_grupo ON modificadores(grupo_id);
CREATE INDEX IF NOT EXISTS idx_prodgrupos_producto ON producto_grupos(producto_id);
CREATE INDEX IF NOT EXISTS idx_detmod_detalle ON detalle_modificadores(detalle_id);
`

export function crearEsquema(db: Database.Database): void {
  db.exec(DDL)
}
