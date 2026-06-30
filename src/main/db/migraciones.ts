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

// Convierte los grupos de modificadores de "por producto" a reutilizables:
// mueve la relación producto→grupo a la tabla producto_grupos y quita
// producto_id de grupos_modificadores (conservando ids y modificadores).
function reconstruirGrupos(db: Database.Database): void {
  db.pragma('foreign_keys = OFF')
  const tx = db.transaction(() => {
    // Copia la relación existente a la tabla puente (creada por crearEsquema).
    db.exec(
      'INSERT OR IGNORE INTO producto_grupos (producto_id, grupo_id, orden) SELECT producto_id, id, orden FROM grupos_modificadores'
    )
    db.exec(`
      CREATE TABLE grupos_modificadores_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre      TEXT    NOT NULL,
        obligatorio INTEGER NOT NULL DEFAULT 0,
        multiple    INTEGER NOT NULL DEFAULT 0
      );
    `)
    db.exec(
      'INSERT INTO grupos_modificadores_new (id, nombre, obligatorio, multiple) SELECT id, nombre, obligatorio, multiple FROM grupos_modificadores'
    )
    db.exec('DROP TABLE grupos_modificadores;')
    db.exec('ALTER TABLE grupos_modificadores_new RENAME TO grupos_modificadores;')
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
  // Propina por orden (aditiva).
  if (!columnas(db, 'ordenes').includes('propina')) {
    db.exec('ALTER TABLE ordenes ADD COLUMN propina REAL NOT NULL DEFAULT 0')
  }
  // Costo del producto (para reportes de utilidad) (aditiva).
  if (!columnas(db, 'productos').includes('costo')) {
    db.exec('ALTER TABLE productos ADD COLUMN costo REAL NOT NULL DEFAULT 0')
  }

  // Columna de gastos en cortes (aditiva).
  if (!columnas(db, 'cortes').includes('total_gastos')) {
    db.exec('ALTER TABLE cortes ADD COLUMN total_gastos REAL NOT NULL DEFAULT 0')
  }
  // Total de propinas del turno en cortes (aditiva).
  if (!columnas(db, 'cortes').includes('total_propinas')) {
    db.exec('ALTER TABLE cortes ADD COLUMN total_propinas REAL NOT NULL DEFAULT 0')
  }

  // Cuadre de caja en cortes: fondo inicial, conteo físico y diferencia (aditivas).
  const colsCortes = columnas(db, 'cortes')
  if (!colsCortes.includes('fondo_inicial')) {
    db.exec('ALTER TABLE cortes ADD COLUMN fondo_inicial REAL NOT NULL DEFAULT 0')
  }
  if (!colsCortes.includes('efectivo_contado')) {
    db.exec('ALTER TABLE cortes ADD COLUMN efectivo_contado REAL')
  }
  if (!colsCortes.includes('diferencia')) {
    db.exec('ALTER TABLE cortes ADD COLUMN diferencia REAL')
  }

  // Color de mesa (aditiva).
  if (!columnas(db, 'mesas').includes('color')) {
    db.exec('ALTER TABLE mesas ADD COLUMN color TEXT')
  }

  // Comensal en el detalle de orden (aditiva).
  if (!columnas(db, 'detalle_ordenes').includes('comensal')) {
    db.exec('ALTER TABLE detalle_ordenes ADD COLUMN comensal INTEGER NOT NULL DEFAULT 1')
  }

  // Control de inventario por producto (aditivas).
  const colsProd = columnas(db, 'productos')
  if (!colsProd.includes('controlar_stock')) {
    db.exec('ALTER TABLE productos ADD COLUMN controlar_stock INTEGER NOT NULL DEFAULT 0')
  }
  if (!colsProd.includes('stock')) {
    db.exec('ALTER TABLE productos ADD COLUMN stock REAL NOT NULL DEFAULT 0')
  }
  if (!colsProd.includes('stock_minimo')) {
    db.exec('ALTER TABLE productos ADD COLUMN stock_minimo REAL NOT NULL DEFAULT 0')
  }

  // Grupos de modificadores reutilizables.
  if (columnas(db, 'grupos_modificadores').includes('producto_id')) {
    reconstruirGrupos(db)
  }

  // Pago mixto: si aún no hay ningún pago registrado, genera uno por cada orden
  // cobrada a partir de su método único (conserva los totales del resumen).
  const hayPagos = db.prepare('SELECT 1 FROM pagos LIMIT 1').get()
  if (!hayPagos) {
    db.exec(`
      INSERT INTO pagos (orden_id, metodo, monto)
      SELECT id, metodo_pago, total - descuento
      FROM ordenes
      WHERE estado = 'cobrada' AND metodo_pago IS NOT NULL
    `)
  }

  // Impresora por categoría (aditiva) + migración de la config a varias impresoras.
  if (!columnas(db, 'categorias').includes('impresora_id')) {
    db.exec('ALTER TABLE categorias ADD COLUMN impresora_id TEXT')
  }
  migrarImpresoras(db)
  asegurarRolesPredefinidos(db)
}

// Garantiza que existan los 3 roles predefinidos (Caja, Barra, Cocina) en la
// config, agregando los que falten. Idempotente: corre en cada arranque.
function asegurarRolesPredefinidos(db: Database.Database): void {
  const fila = db.prepare("SELECT valor FROM config WHERE clave = 'impresoras'").get() as
    | { valor: string }
    | undefined
  if (!fila) return // sin config aún: el default ya trae los 3
  let cfg: Record<string, unknown>
  try {
    cfg = JSON.parse(fila.valor)
  } catch {
    return
  }
  if (!Array.isArray(cfg.impresoras)) return
  const lista = cfg.impresoras as { id: string; nombre: string }[]
  const predef: [string, string][] = [
    ['caja', 'Caja'],
    ['barra', 'Barra'],
    ['cocina', 'Cocina']
  ]
  let cambio = false
  for (const [id, nombre] of predef) {
    if (!lista.some((i) => i.id === id)) {
      lista.push({ id, nombre })
      cambio = true
    }
  }
  const tieneId = (id: string): boolean => lista.some((i) => i.id === id)
  if (!cfg.impresoraCajaId && tieneId('caja')) {
    cfg.impresoraCajaId = 'caja'
    cambio = true
  }
  if (cfg.impresoraCocinaId === undefined && tieneId('cocina')) {
    cfg.impresoraCocinaId = 'cocina'
    cambio = true
  }
  if (cfg.impresoraBarraId === undefined && tieneId('barra')) {
    cfg.impresoraBarraId = 'barra'
    cambio = true
  }
  if (cfg.modo !== 'una' && cfg.modo !== 'multiple') {
    cfg.modo = 'una'
    cambio = true
  }
  if (cambio) {
    db.prepare("UPDATE config SET valor = ? WHERE clave = 'impresoras'").run(JSON.stringify(cfg))
  }
}

// Convierte la config vieja (caja/cocina/modo) al modelo nuevo (lista de
// impresoras + impresoraCajaId) y asigna las categorías existentes a la cocina,
// preservando el comportamiento previo.
function migrarImpresoras(db: Database.Database): void {
  const fila = db.prepare("SELECT valor FROM config WHERE clave = 'impresoras'").get() as
    | { valor: string }
    | undefined
  if (!fila) return
  let cfg: Record<string, unknown>
  try {
    cfg = JSON.parse(fila.valor)
  } catch {
    return
  }
  if (Array.isArray(cfg.impresoras)) return // ya está en el modelo nuevo

  const impresoras: Record<string, unknown>[] = []
  const conv = (old: Record<string, unknown> | null | undefined, id: string, nombre: string): void => {
    if (!old) return
    impresoras.push({
      id,
      nombre,
      tipo: old.tipo,
      dispositivoId: old.id ?? undefined,
      puerto: old.puerto ?? undefined,
      baudRate: old.baudRate ?? undefined
    })
  }
  conv(cfg.caja as Record<string, unknown> | null, 'caja', 'Caja')
  const teniaCocina = cfg.modo === 'dos' && cfg.cocina
  if (teniaCocina) conv(cfg.cocina as Record<string, unknown>, 'cocina', 'Cocina')
  const cocinaId = teniaCocina ? 'cocina' : cfg.caja ? 'caja' : null

  const nuevo = {
    nombreNegocio: cfg.nombreNegocio ?? '',
    direccion: cfg.direccion ?? '',
    telefono: cfg.telefono ?? '',
    modo: cfg.modo === 'dos' ? 'multiple' : 'una',
    cortarPapel: cfg.cortarPapel ?? true,
    abrirCajon: cfg.abrirCajon ?? false,
    avanceFinal: cfg.avanceFinal ?? 4,
    ancho: cfg.ancho ?? 32,
    cocinaGrande: cfg.cocinaGrande ?? true,
    impuestoActivo: cfg.impuestoActivo ?? false,
    impuestoTasa: cfg.impuestoTasa ?? 16,
    impuestoIncluido: cfg.impuestoIncluido ?? true,
    impresoras,
    impresoraCajaId: cfg.caja ? 'caja' : null,
    impresoraCocinaId: cocinaId,
    impresoraBarraId: cocinaId
  }
  db.prepare("UPDATE config SET valor = ? WHERE clave = 'impresoras'").run(JSON.stringify(nuevo))
  // Las comandas viejas eran de cocina → la columna impresora_id guarda el ROL.
  db.prepare("UPDATE categorias SET impresora_id = 'cocina' WHERE impresora_id IS NULL").run()
}
