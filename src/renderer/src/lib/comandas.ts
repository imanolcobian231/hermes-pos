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

/**
 * Agrupa las líneas de una comanda por impresora: producto → categoría → rol
 * (cocina/barra) → impresora del rol. Si el rol de la categoría no tiene
 * impresora configurada, cae a la otra impresora de comanda que sí lo esté (así
 * un negocio de solo bebidas opera con Barra sin tocar las categorías). Las
 * líneas sin rol, o cuando ninguna impresora de comanda está lista, se devuelven
 * aparte (no se imprimen).
 */
export function agruparPorImpresora(
  lineas: DetalleOrden[],
  productos: Producto[],
  categorias: Categoria[],
  roles: RolesImpresion
): { porImpresora: Map<string, DetalleOrden[]>; sinImpresora: DetalleOrden[] } {
  const catDeProducto = new Map(productos.map((p) => [p.id, p.categoriaId]))
  const rolDeCat = new Map(categorias.map((c) => [c.id, c.rol]))
  const porImpresora = new Map<string, DetalleOrden[]>()
  const sinImpresora: DetalleOrden[] = []
  for (const linea of lineas) {
    const catId = catDeProducto.get(linea.productoId)
    const rol = catId != null ? rolDeCat.get(catId) : undefined
    const directo = rol === 'cocina' ? roles.cocina : rol === 'barra' ? roles.barra : null
    // Con rol: su impresora, o la otra de comanda configurada (fallback). Sin rol: no imprime.
    const impId = rol ? (directo ?? roles.cocina ?? roles.barra ?? null) : null
    if (!impId) {
      sinImpresora.push(linea)
      continue
    }
    const arr = porImpresora.get(impId) ?? []
    arr.push(linea)
    porImpresora.set(impId, arr)
  }
  return { porImpresora, sinImpresora }
}
