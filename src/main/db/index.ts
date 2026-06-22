import { obtenerDb } from './conexion'
import { crearEsquema } from './esquema'
import { migrar } from './migraciones'
import { sembrarDatos } from './seed'

export { obtenerDb, cerrarDb } from './conexion'

/** Abre la DB, crea el esquema, aplica migraciones y siembra datos iniciales. */
export function inicializarDb(): void {
  const db = obtenerDb()
  crearEsquema(db)
  migrar(db)
  sembrarDatos(db)
  purgarOrdenesVacias(db)
}

// Elimina órdenes abiertas sin productos (ej. una mesa o pedido para llevar que
// se abrió y se cerró la app sin agregar nada) y libera sus mesas.
function purgarOrdenesVacias(db: ReturnType<typeof obtenerDb>): void {
  const tx = db.transaction(() => {
    db.exec(`
      UPDATE mesas SET estado = 'libre' WHERE id IN (
        SELECT o.mesa_id FROM ordenes o
        WHERE o.estado = 'abierta' AND o.mesa_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM detalle_ordenes d WHERE d.orden_id = o.id)
      );
      DELETE FROM ordenes
      WHERE estado = 'abierta'
        AND NOT EXISTS (SELECT 1 FROM detalle_ordenes d WHERE d.orden_id = ordenes.id);
    `)
  })
  tx()
}
