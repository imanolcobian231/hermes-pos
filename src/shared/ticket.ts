import type { DetalleOrden } from './types'

// Línea agregada para el ticket de cobro (sin distinguir comensal).
export interface LineaTicket {
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  modificadores: { nombre: string; precio: number }[]
}

/**
 * Combina las líneas idénticas de una orden (mismo producto, precio y
 * modificadores) sumando cantidades, sin separar por comensal. Se usa en el
 * ticket de cobro para que el cliente vea los productos agrupados.
 */
export function agruparLineas(detalle: DetalleOrden[]): LineaTicket[] {
  const mapa = new Map<string, LineaTicket>()
  for (const d of detalle) {
    const modsKey = d.modificadores
      .map((m) => `${m.nombre}:${m.precio}`)
      .sort()
      .join('|')
    const clave = `${d.nombreProducto}|${d.precioUnitario}|${modsKey}`
    const existente = mapa.get(clave)
    if (existente) {
      existente.cantidad += d.cantidad
    } else {
      mapa.set(clave, {
        nombreProducto: d.nombreProducto,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        modificadores: d.modificadores.map((m) => ({ nombre: m.nombre, precio: m.precio }))
      })
    }
  }
  return [...mapa.values()]
}
