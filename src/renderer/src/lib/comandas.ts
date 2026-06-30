import type { Categoria, DetalleOrden, Impresora, Producto } from '@shared/types'

/** Impresoras (configuradas) asignadas a cada rol de comanda. */
export interface RolesImpresion {
  cocina: string | null
  barra: string | null
}

/**
 * Devuelve, por rol de comanda, el id de impresora SOLO si esa impresora está
 * configurada (tiene conexión). Así un lugar que solo conecta Barra deja Cocina
 * en null y el ruteo manda todo a Barra.
 */
export function rolesConfigurados(
  impresoras: Impresora[],
  cocinaId: string | null,
  barraId: string | null
): RolesImpresion {
  const conf = (id: string | null): string | null =>
    id && impresoras.some((i) => i.id === id && i.tipo != null) ? id : null
  return { cocina: conf(cocinaId), barra: conf(barraId) }
}

export type AreaComanda = 'cocina' | 'barra'

/** Un ticket de comanda: su área (para el encabezado) y la impresora destino. */
export interface GrupoComanda {
  area: AreaComanda
  impresoraId: string
  lineas: DetalleOrden[]
}

/**
 * Reparte las líneas en comandas POR ÁREA (cocina/barra). El área sale de la
 * categoría (sin marcar → cocina). Cada área se imprime como su propio ticket.
 *
 * - `impresoraUnica` (modo "una impresora"): todas las comandas van a esa
 *   impresora, pero SEPARADAS por área (un ticket COCINA y otro BARRA).
 * - Si no, cada área va a la impresora de su rol; si esa no está configurada,
 *   cae a la otra de comanda (así "solo barra" o "solo cocina" funcionan).
 *
 * Las líneas sin ninguna impresora de comanda disponible se devuelven aparte.
 */
export function comandasPorArea(
  lineas: DetalleOrden[],
  productos: Producto[],
  categorias: Categoria[],
  roles: RolesImpresion,
  impresoraUnica?: string | null,
  separarBarra = true
): { grupos: GrupoComanda[]; sinImpresora: DetalleOrden[] } {
  const catDeProducto = new Map(productos.map((p) => [p.id, p.categoriaId]))
  const rolDeCat = new Map(categorias.map((c) => [c.id, c.rol]))
  const acc = new Map<string, GrupoComanda>()
  const sinImpresora: DetalleOrden[] = []
  for (const linea of lineas) {
    const catId = catDeProducto.get(linea.productoId)
    const rol = catId != null ? rolDeCat.get(catId) : undefined
    // Si la separación está apagada, todo se trata como cocina (un solo ticket).
    const area: AreaComanda = separarBarra && rol === 'barra' ? 'barra' : 'cocina'
    const impresoraId =
      impresoraUnica ??
      (area === 'barra' ? roles.barra ?? roles.cocina : roles.cocina ?? roles.barra)
    if (!impresoraId) {
      sinImpresora.push(linea)
      continue
    }
    const clave = `${area}:${impresoraId}`
    let g = acc.get(clave)
    if (!g) {
      g = { area, impresoraId, lineas: [] }
      acc.set(clave, g)
    }
    g.lineas.push(linea)
  }
  return { grupos: [...acc.values()], sinImpresora }
}
