// Tipos compartidos entre el proceso main (Electron) y el renderer (React).
// Ver documentación: Hermes POS / Tipos TypeScript.

export type Rol = 'admin' | 'cajero' | 'mesero'

export interface Usuario {
  id: number
  nombre: string
  rol: Rol
  /** Opcional; reservado para una futura versión con cuentas en la nube. No se usa para iniciar sesión. */
  email?: string
  activo: boolean
}

export interface UsuarioInput {
  id?: number
  nombre: string
  rol: Rol
  email?: string
  /** PIN en texto plano; requerido al crear, opcional al editar (vacío = no cambia). */
  pin?: string
}

export type EstadoMesa = 'libre' | 'ocupada' | 'por_cobrar'
export type EstadoOrden = 'abierta' | 'cobrada' | 'cancelada'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'
/**
 * Método guardado en la orden: 'mixto' = más de un método; 'credito' = fiada
 * (se cargó a la cuenta de un cliente, sin recibir dinero al momento).
 */
export type MetodoPagoOrden = MetodoPago | 'mixto' | 'credito'

/** Un pago aplicado a una orden (parte del total cubierta por un método). */
export interface Pago {
  metodo: MetodoPago
  monto: number
}

export interface Mesa {
  id: number
  numero: number
  /** Nombre editable de la mesa (ej. "Terraza 1", "Barra"). Por defecto "Mesa N". */
  nombre: string
  capacidad: number
  estado: EstadoMesa
  /** Color de acento de la mesa (hex). Opcional; sirve para agrupar zonas. */
  color?: string
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

/** Grupo de modificadores reutilizable (ej. "Término", "Salsas", "Extras"). */
export interface GrupoModificador {
  id: number
  nombre: string
  /** Si true, hay que elegir al menos un modificador del grupo. */
  obligatorio: boolean
  /** true = selección múltiple (checkboxes); false = selección única (radio). */
  multiple: boolean
  /** Orden dentro del producto (cuando el grupo viene asignado a uno). */
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
  metodoPago?: MetodoPagoOrden
  /** Desglose de pagos (1 = método único; varios = pago mixto). */
  pagos?: Pago[]
  /** Efectivo recibido (solo para calcular el cambio de la parte en efectivo). */
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
  /** Número de comensal al que pertenece la línea (1 por defecto). */
  comensal: number
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
  totalGastos: number
  numOrdenes: number
  /** Efectivo con el que se abrió la caja (fondo de cambio). */
  fondoInicial: number
  /** Efectivo realmente contado en el cajón al cerrar (null = no se contó). */
  efectivoContado?: number
  /** Diferencia entre lo contado y lo esperado: + sobrante, − faltante. */
  diferencia?: number
  cerradoEn: string
}

/** Datos del cuadre que captura el cajero al cerrar el turno. */
export interface CierreCorteInput {
  /** Fondo de caja inicial (cambio con el que se abrió). */
  fondoInicial: number
  /** Efectivo contado físicamente en el cajón (undefined = no se contó). */
  efectivoContado?: number
}

/** Registro de auditoría de una orden cancelada. */
export interface Cancelacion {
  id: number
  ordenId: number
  motivo: string
  usuario: string
  total: number
  canceladoEn: string
}

export interface Gasto {
  id: number
  concepto: string
  monto: number
  fecha: string
}

export interface GastoInput {
  concepto: string
  monto: number
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
  nombre: string
  obligatorio: boolean
  multiple: boolean
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
  color?: string
}

// --- Impresión ---------------------------------------------------------------

/** Destino lógico de un ticket: comanda de cocina o ticket de caja (cliente). */
export type DestinoImpresion = 'cocina' | 'caja'

/** Tipo de conexión de una impresora. */
export type TipoImpresora = 'bluetooth' | 'com'

/**
 * Impresora configurada. 'bluetooth' = Bluetooth LE (conexión directa desde la
 * app, sin emparejar). 'com' = Bluetooth Clásico/serial por puerto COM (ej.
 * PT-210), emparejada en Windows (sin drivers).
 */
export interface ConfigImpresora {
  tipo: TipoImpresora
  /** Nombre legible para mostrar en Ajustes. */
  nombre: string
  /** Bluetooth BLE: id del dispositivo (asignado por Web Bluetooth). */
  id?: string
  /** COM: puerto (ej. "COM5") y baudios. */
  puerto?: string
  baudRate?: number
}

export interface ConfigImpresoras {
  /** Nombre del negocio que se imprime como encabezado del ticket. */
  nombreNegocio: string
  /** Dirección del negocio (se imprime bajo el nombre). Opcional. */
  direccion: string
  /** Teléfono del negocio (se imprime bajo la dirección). Opcional. */
  telefono: string
  /** 'una' = una sola impresora para todo; 'dos' = cocina y caja por separado. */
  modo: 'una' | 'dos'
  /** Impresora de caja / ticket final. En modo 'una' imprime también la cocina. */
  caja: ConfigImpresora | null
  /** Impresora de cocina (comandas). Solo se usa en modo 'dos'. */
  cocina: ConfigImpresora | null
  /** Cortar el papel automáticamente al final de cada ticket. */
  cortarPapel: boolean
  /** Enviar pulso para abrir el cajón de dinero al imprimir el ticket de caja. */
  abrirCajon: boolean
  /** Líneas de papel que avanza al terminar (para poder arrancar el ticket). */
  avanceFinal: number
  /** Ancho del ticket en columnas de texto: 32 para 58 mm, 48 para 80 mm. */
  ancho: number
  /** Imprime las comandas de cocina con letra grande (doble tamaño). */
  cocinaGrande: boolean
  /** Aplica impuesto (IVA) al ticket. */
  impuestoActivo: boolean
  /** Tasa del impuesto en porcentaje (ej. 16). */
  impuestoTasa: number
  /** true = los precios ya incluyen el IVA; false = el IVA se suma al total. */
  impuestoIncluido: boolean
}

/** Un dispositivo Bluetooth ofrecido por el selector (main → renderer). */
export interface DispositivoBluetooth {
  id: string
  nombre: string
}

// --- Respaldo de la base de datos --------------------------------------------

export interface ConfigRespaldo {
  /** Respaldar automáticamente (al abrir la app cada día y al cerrar turno). */
  automatico: boolean
  /** Carpeta destino (ej. USB/nube). null = carpeta predeterminada de la app. */
  carpeta: string | null
  /** Fecha ISO del último respaldo realizado. */
  ultimo: string | null
}

/** Un archivo de respaldo existente, para mostrar en Ajustes. */
export interface RespaldoInfo {
  nombre: string
  ruta: string
  fecha: string
  /** Tamaño en bytes. */
  tamano: number
}

/** Totales del turno en curso (órdenes cobradas aún no incluidas en un corte). */
export interface ResumenTurno {
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  totalGastos: number
  numOrdenes: number
}

// --- Créditos / fiados -------------------------------------------------------

export interface Cliente {
  id: number
  nombre: string
  telefono?: string
  nota?: string
  activo: boolean
  /** Saldo que debe el cliente (cargos − abonos). Lo calcula el backend. */
  saldo: number
}

export interface ClienteInput {
  id?: number
  nombre: string
  telefono?: string
  nota?: string
}

/** Movimiento en la cuenta de un cliente: un cargo (fiado) o un abono (pago). */
export interface MovimientoCredito {
  id: number
  clienteId: number
  tipo: 'cargo' | 'abono'
  monto: number
  /** Método del abono (efectivo/tarjeta/transferencia). Vacío en los cargos. */
  metodo?: MetodoPago
  /** Orden que originó el cargo (si aplica). */
  ordenId?: number
  nota?: string
  creadoEn: string
}

// --- Reportes históricos -----------------------------------------------------

export interface ReporteResumen {
  /** Total cobrado (suma de pagos) en el rango. */
  ventas: number
  numOrdenes: number
  /** Ticket promedio = ventas / numOrdenes. */
  ticketPromedio: number
  /** Total de descuentos otorgados en el rango. */
  descuentos: number
}

/** Ventas de un día (clave YYYY-MM-DD en hora local). */
export interface VentaDia {
  fecha: string
  ventas: number
  numOrdenes: number
}

/** Un producto y cuánto se vendió en el rango. */
export interface ProductoVendido {
  nombre: string
  cantidad: number
  importe: number
}

export interface VentasPorMetodo {
  efectivo: number
  tarjeta: number
  transferencia: number
}

/** Reporte de ventas para un rango de fechas (YYYY-MM-DD, inclusivo). */
export interface ReporteVentas {
  desde: string
  hasta: string
  resumen: ReporteResumen
  porDia: VentaDia[]
  topProductos: ProductoVendido[]
  porMetodo: VentasPorMetodo
}
