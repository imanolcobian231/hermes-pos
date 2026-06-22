// Tipos compartidos entre el proceso main (Electron) y el renderer (React).
// Ver documentación: Hermes POS / Tipos TypeScript.

export type EstadoMesa = 'libre' | 'ocupada' | 'por_cobrar'
export type EstadoOrden = 'abierta' | 'cobrada' | 'cancelada'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'

export interface Mesa {
  id: number
  numero: number
  /** Nombre editable de la mesa (ej. "Terraza 1", "Barra"). Por defecto "Mesa N". */
  nombre: string
  capacidad: number
  estado: EstadoMesa
}

export interface Categoria {
  id: number
  nombre: string
  orden: number
}

export interface Producto {
  id: number
  nombre: string
  precio: number
  categoriaId: number
  activo: boolean
  descripcion?: string
  /** Grupos de modificadores del producto (incluidos al listar el catálogo). */
  grupos?: GrupoModificador[]
}

/** Grupo de modificadores de un producto (ej. "Término", "Extras"). */
export interface GrupoModificador {
  id: number
  productoId: number
  nombre: string
  /** Si true, hay que elegir al menos un modificador del grupo. */
  obligatorio: boolean
  /** true = selección múltiple (checkboxes); false = selección única (radio). */
  multiple: boolean
  orden: number
  modificadores: Modificador[]
}

export interface Modificador {
  id: number
  grupoId: number
  nombre: string
  /** Precio extra; 0 = modificador sin costo. */
  precio: number
}

export interface Orden {
  id: number
  /** null cuando es un pedido para llevar (sin mesa física). */
  mesaId: number | null
  paraLlevar: boolean
  /** Etiqueta del pedido para llevar (ej. "Para llevar #3"). */
  nombre?: string
  estado: EstadoOrden
  /** Subtotal: suma de las líneas (sin descuento). */
  total: number
  /** Descuento aplicado al cobrar (monto en pesos). El neto a pagar es total - descuento. */
  descuento: number
  /** La orden está lista para cobrar (a nivel orden, sirve para mesa y para llevar). */
  porCobrar: boolean
  metodoPago?: MetodoPago
  montoRecibido?: number
  cambio?: number
  ticketImpreso: boolean
  abiertoEn: string
  cerradoEn?: string
}

export interface DetalleOrden {
  id: number
  ordenId: number
  productoId: number
  nombreProducto: string
  cantidad: number
  /** Precio efectivo unitario (base + modificadores). */
  precioUnitario: number
  notas?: string
  enviadoCocina: boolean
  enviadoEn?: string
  modificadores: DetalleModificador[]
}

/** Modificador elegido en una línea de la orden (snapshot de nombre y precio). */
export interface DetalleModificador {
  id: number
  detalleId: number
  modificadorId: number | null
  nombre: string
  precio: number
}

export interface Corte {
  id: number
  fecha: string
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  numOrdenes: number
  cerradoEn: string
}

export interface Reimpresion {
  id: number
  tipo: 'cocina' | 'final'
  ordenId: number
  usuario: string
  reimprimirEn: string
}

// --- Tipos de entrada/salida para la API (main <-> renderer) ---------------

export interface OrdenConDetalle extends Orden {
  detalle: DetalleOrden[]
}

export type ProductoInput = Omit<Producto, 'id' | 'grupos'> & { id?: number }
export type CategoriaInput = Omit<Categoria, 'id'> & { id?: number }

export interface GrupoInput {
  id?: number
  productoId: number
  nombre: string
  obligatorio: boolean
  multiple: boolean
  orden: number
}

export interface ModificadorInput {
  id?: number
  grupoId: number
  nombre: string
  precio: number
}
export interface MesaInput {
  nombre: string
  capacidad: number
}

/** Totales del turno en curso (órdenes cobradas aún no incluidas en un corte). */
export interface ResumenTurno {
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  numOrdenes: number
}
