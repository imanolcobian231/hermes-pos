import type {
  Cancelacion,
  Categoria,
  Cliente,
  Corte,
  Gasto,
  DetalleModificador,
  DetalleOrden,
  EstadoMesa,
  EstadoOrden,
  GrupoModificador,
  Insumo,
  Mesa,
  MetodoPago,
  MetodoPagoOrden,
  Modificador,
  MovimientoCredito,
  MovimientoInventario,
  Orden,
  TipoMovInventario,
  Producto,
  Reimpresion,
  Rol,
  Usuario
} from '@shared/types'

// Conversión de filas SQLite (snake_case, flags 0/1) a los tipos del dominio.

export function aMesa(r: Record<string, unknown>): Mesa {
  return {
    id: r.id as number,
    numero: r.numero as number,
    nombre: r.nombre as string,
    capacidad: r.capacidad as number,
    estado: r.estado as EstadoMesa,
    color: (r.color as string | null) ?? undefined
  }
}

export function aUsuario(r: Record<string, unknown>): Usuario {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    rol: r.rol as Rol,
    email: (r.email as string | null) ?? undefined,
    activo: Boolean(r.activo)
  }
}

export function aCategoria(r: Record<string, unknown>): Categoria {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    orden: r.orden as number
  }
}

export function aProducto(r: Record<string, unknown>): Producto {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    precio: r.precio as number,
    categoriaId: r.categoria_id as number,
    activo: Boolean(r.activo),
    descripcion: (r.descripcion as string | null) ?? undefined,
    controlarStock: Boolean(r.controlar_stock),
    stock: (r.stock as number | null) ?? 0,
    stockMinimo: (r.stock_minimo as number | null) ?? 0
  }
}

export function aOrden(r: Record<string, unknown>): Orden {
  return {
    id: r.id as number,
    mesaId: (r.mesa_id as number | null) ?? null,
    paraLlevar: Boolean(r.para_llevar),
    nombre: (r.nombre as string | null) ?? undefined,
    estado: r.estado as EstadoOrden,
    total: r.total as number,
    descuento: (r.descuento as number | null) ?? 0,
    porCobrar: Boolean(r.por_cobrar),
    metodoPago: (r.metodo_pago as MetodoPagoOrden | null) ?? undefined,
    montoRecibido: (r.monto_recibido as number | null) ?? undefined,
    cambio: (r.cambio as number | null) ?? undefined,
    ticketImpreso: Boolean(r.ticket_impreso),
    abiertoEn: r.abierto_en as string,
    cerradoEn: (r.cerrado_en as string | null) ?? undefined
  }
}

export function aDetalle(
  r: Record<string, unknown>,
  modificadores: DetalleModificador[] = []
): DetalleOrden {
  return {
    id: r.id as number,
    ordenId: r.orden_id as number,
    productoId: r.producto_id as number,
    nombreProducto: r.nombre_producto as string,
    cantidad: r.cantidad as number,
    precioUnitario: r.precio_unitario as number,
    notas: (r.notas as string | null) ?? undefined,
    comensal: (r.comensal as number | null) ?? 1,
    enviadoCocina: Boolean(r.enviado_cocina),
    enviadoEn: (r.enviado_en as string | null) ?? undefined,
    modificadores
  }
}

export function aGrupo(
  r: Record<string, unknown>,
  modificadores: Modificador[] = []
): GrupoModificador {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    obligatorio: Boolean(r.obligatorio),
    multiple: Boolean(r.multiple),
    orden: (r.orden as number | null) ?? 0,
    modificadores
  }
}

export function aModificador(r: Record<string, unknown>): Modificador {
  return {
    id: r.id as number,
    grupoId: r.grupo_id as number,
    nombre: r.nombre as string,
    precio: r.precio as number
  }
}

export function aDetalleModificador(r: Record<string, unknown>): DetalleModificador {
  return {
    id: r.id as number,
    detalleId: r.detalle_id as number,
    modificadorId: (r.modificador_id as number | null) ?? null,
    nombre: r.nombre as string,
    precio: r.precio as number
  }
}

export function aCorte(r: Record<string, unknown>): Corte {
  return {
    id: r.id as number,
    fecha: r.fecha as string,
    totalEfectivo: r.total_efectivo as number,
    totalTarjeta: r.total_tarjeta as number,
    totalTransferencia: r.total_transferencia as number,
    totalGastos: (r.total_gastos as number | null) ?? 0,
    numOrdenes: r.num_ordenes as number,
    fondoInicial: (r.fondo_inicial as number | null) ?? 0,
    efectivoContado: (r.efectivo_contado as number | null) ?? undefined,
    diferencia: (r.diferencia as number | null) ?? undefined,
    cerradoEn: r.cerrado_en as string
  }
}

export function aCancelacion(r: Record<string, unknown>): Cancelacion {
  return {
    id: r.id as number,
    ordenId: r.orden_id as number,
    motivo: r.motivo as string,
    usuario: r.usuario as string,
    total: r.total as number,
    canceladoEn: r.cancelado_en as string
  }
}

export function aGasto(r: Record<string, unknown>): Gasto {
  return {
    id: r.id as number,
    concepto: r.concepto as string,
    monto: r.monto as number,
    fecha: r.fecha as string
  }
}

export function aCliente(r: Record<string, unknown>): Cliente {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    telefono: (r.telefono as string | null) ?? undefined,
    nota: (r.nota as string | null) ?? undefined,
    activo: Boolean(r.activo),
    saldo: (r.saldo as number | null) ?? 0
  }
}

export function aMovimientoCredito(r: Record<string, unknown>): MovimientoCredito {
  return {
    id: r.id as number,
    clienteId: r.cliente_id as number,
    tipo: r.tipo as 'cargo' | 'abono',
    monto: r.monto as number,
    metodo: (r.metodo as MetodoPago | null) ?? undefined,
    ordenId: (r.orden_id as number | null) ?? undefined,
    nota: (r.nota as string | null) ?? undefined,
    creadoEn: r.creado_en as string
  }
}

export function aInsumo(r: Record<string, unknown>): Insumo {
  return {
    id: r.id as number,
    nombre: r.nombre as string,
    unidad: r.unidad as string,
    stock: r.stock as number,
    stockMinimo: r.stock_minimo as number,
    costo: r.costo as number,
    activo: Boolean(r.activo)
  }
}

export function aMovimientoInventario(r: Record<string, unknown>): MovimientoInventario {
  return {
    id: r.id as number,
    insumoId: r.insumo_id as number,
    tipo: r.tipo as TipoMovInventario,
    cantidad: r.cantidad as number,
    nota: (r.nota as string | null) ?? undefined,
    usuario: r.usuario as string,
    creadoEn: r.creado_en as string
  }
}

export function aReimpresion(r: Record<string, unknown>): Reimpresion {
  return {
    id: r.id as number,
    tipo: r.tipo as 'cocina' | 'final',
    ordenId: r.orden_id as number,
    usuario: r.usuario as string,
    reimprimirEn: r.reimprimir_en as string
  }
}
