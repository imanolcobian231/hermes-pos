import { contextBridge, ipcRenderer } from 'electron'
import { CANALES } from '@shared/canales'
import type {
  Cancelacion,
  Categoria,
  CategoriaInput,
  CierreCorteInput,
  Cliente,
  ClienteInput,
  ConfigImpresoras,
  ConfigRespaldo,
  Corte,
  DestinoImpresion,
  DispositivoBluetooth,
  DetalleOrden,
  EstadoCaja,
  Gasto,
  GrupoInput,
  GrupoModificador,
  Insumo,
  InsumoInput,
  LogoTicket,
  Mesa,
  MesaInput,
  MetodoPago,
  Modificador,
  ModificadorInput,
  MovimientoCredito,
  MovimientoInventario,
  OrdenConDetalle,
  Pago,
  Producto,
  ProductoInput,
  Reimpresion,
  ReporteVentas,
  ResumenInventario,
  RespaldoInfo,
  TipoMovInventario,
  ResumenTurno,
  Usuario,
  UsuarioInput
} from '@shared/types'

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

// API segura expuesta al renderer (window.api). Tipada de extremo a extremo.
const api = {
  mesas: {
    listar: (): Promise<Mesa[]> => invoke(CANALES.mesas.listar),
    crear: (capacidad?: number): Promise<Mesa> => invoke(CANALES.mesas.crear, capacidad),
    editar: (id: number, datos: MesaInput): Promise<Mesa> => invoke(CANALES.mesas.editar, id, datos),
    renombrar: (id: number, nombre: string): Promise<Mesa> =>
      invoke(CANALES.mesas.renombrar, id, nombre),
    eliminar: (id: number): Promise<void> => invoke(CANALES.mesas.eliminar, id)
  },
  catalogo: {
    categorias: (): Promise<Categoria[]> => invoke(CANALES.catalogo.categorias),
    guardarCategoria: (cat: CategoriaInput): Promise<Categoria> =>
      invoke(CANALES.catalogo.guardarCategoria, cat),
    eliminarCategoria: (id: number): Promise<void> => invoke(CANALES.catalogo.eliminarCategoria, id),
    productos: (): Promise<Producto[]> => invoke(CANALES.catalogo.productos),
    guardarProducto: (prod: ProductoInput): Promise<Producto> =>
      invoke(CANALES.catalogo.guardarProducto, prod),
    eliminarProducto: (id: number): Promise<void> => invoke(CANALES.catalogo.eliminarProducto, id),
    grupos: (): Promise<GrupoModificador[]> => invoke(CANALES.catalogo.grupos),
    guardarGrupo: (g: GrupoInput): Promise<GrupoModificador> =>
      invoke(CANALES.catalogo.guardarGrupo, g),
    eliminarGrupo: (id: number): Promise<void> => invoke(CANALES.catalogo.eliminarGrupo, id),
    guardarModificador: (m: ModificadorInput): Promise<Modificador> =>
      invoke(CANALES.catalogo.guardarModificador, m),
    eliminarModificador: (id: number): Promise<void> =>
      invoke(CANALES.catalogo.eliminarModificador, id),
    asignarGrupo: (productoId: number, grupoId: number): Promise<void> =>
      invoke(CANALES.catalogo.asignarGrupo, productoId, grupoId),
    desasignarGrupo: (productoId: number, grupoId: number): Promise<void> =>
      invoke(CANALES.catalogo.desasignarGrupo, productoId, grupoId),
    masVendidos: (): Promise<{ productoId: number; vendido: number }[]> =>
      invoke(CANALES.catalogo.masVendidos)
  },
  ordenes: {
    activas: (): Promise<OrdenConDetalle[]> => invoke(CANALES.ordenes.activas),
    deMesa: (mesaId: number): Promise<OrdenConDetalle | undefined> =>
      invoke(CANALES.ordenes.deMesa, mesaId),
    abrir: (mesaId: number): Promise<OrdenConDetalle> => invoke(CANALES.ordenes.abrir, mesaId),
    abrirLlevar: (nombre?: string): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.abrirLlevar, nombre),
    descartar: (ordenId: number): Promise<void> => invoke(CANALES.ordenes.descartar, ordenId),
    agregarProducto: (
      ordenId: number,
      productoId: number,
      modificadorIds?: number[],
      comensal?: number
    ): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.agregarProducto, ordenId, productoId, modificadorIds, comensal),
    cambiarCantidad: (ordenId: number, detalleId: number, delta: number): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.cambiarCantidad, ordenId, detalleId, delta),
    cambiarNota: (ordenId: number, detalleId: number, nota: string): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.cambiarNota, ordenId, detalleId, nota),
    quitarLinea: (ordenId: number, detalleId: number): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.quitarLinea, ordenId, detalleId),
    enviarCocina: (ordenId: number, comensal?: number): Promise<DetalleOrden[]> =>
      invoke(CANALES.ordenes.enviarCocina, ordenId, comensal),
    marcarPorCobrar: (ordenId: number): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.marcarPorCobrar, ordenId),
    cobrar: (
      ordenId: number,
      pagos: Pago[],
      efectivoRecibido?: number,
      descuento?: number,
      propina?: number,
      pin?: string
    ): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.cobrar, ordenId, pagos, efectivoRecibido, descuento, propina, pin),
    fiar: (ordenId: number, clienteId: number, descuento?: number): Promise<OrdenConDetalle> =>
      invoke(CANALES.ordenes.fiar, ordenId, clienteId, descuento),
    cancelar: (ordenId: number, motivo: string, usuario?: string, pin?: string): Promise<void> =>
      invoke(CANALES.ordenes.cancelar, ordenId, motivo, usuario, pin),
    devolver: (ordenId: number, motivo: string, usuario?: string, pin?: string): Promise<void> =>
      invoke(CANALES.ordenes.devolver, ordenId, motivo, usuario, pin),
    cobradasTurno: (): Promise<OrdenConDetalle[]> => invoke(CANALES.ordenes.cobradasTurno)
  },
  clientes: {
    listar: (): Promise<Cliente[]> => invoke(CANALES.clientes.listar),
    guardar: (c: ClienteInput): Promise<Cliente> => invoke(CANALES.clientes.guardar, c),
    eliminar: (id: number): Promise<void> => invoke(CANALES.clientes.eliminar, id),
    movimientos: (clienteId: number): Promise<MovimientoCredito[]> =>
      invoke(CANALES.clientes.movimientos, clienteId),
    abonar: (clienteId: number, monto: number, metodo: MetodoPago, nota?: string): Promise<Cliente> =>
      invoke(CANALES.clientes.abonar, clienteId, monto, metodo, nota)
  },
  cortes: {
    resumen: (): Promise<ResumenTurno> => invoke(CANALES.cortes.resumen),
    listar: (): Promise<Corte[]> => invoke(CANALES.cortes.listar),
    cerrar: (cuadre?: CierreCorteInput): Promise<Corte> => invoke(CANALES.cortes.cerrar, cuadre),
    estadoCaja: (): Promise<EstadoCaja> => invoke(CANALES.cortes.estadoCaja),
    abrirCaja: (fondoInicial: number): Promise<EstadoCaja> =>
      invoke(CANALES.cortes.abrirCaja, fondoInicial)
  },
  cancelaciones: {
    listar: (): Promise<Cancelacion[]> => invoke(CANALES.cancelaciones.listar)
  },
  reportes: {
    generar: (desde: string, hasta: string): Promise<ReporteVentas> =>
      invoke(CANALES.reportes.generar, desde, hasta)
  },
  inventario: {
    listar: (): Promise<Insumo[]> => invoke(CANALES.inventario.listar),
    resumen: (): Promise<ResumenInventario> => invoke(CANALES.inventario.resumen),
    guardar: (i: InsumoInput): Promise<Insumo> => invoke(CANALES.inventario.guardar, i),
    eliminar: (id: number): Promise<void> => invoke(CANALES.inventario.eliminar, id),
    movimiento: (
      insumoId: number,
      tipo: TipoMovInventario,
      cantidad: number,
      nota?: string,
      usuario?: string
    ): Promise<Insumo> =>
      invoke(CANALES.inventario.movimiento, insumoId, tipo, cantidad, nota, usuario),
    movimientos: (insumoId: number): Promise<MovimientoInventario[]> =>
      invoke(CANALES.inventario.movimientos, insumoId),
    movimientoProducto: (
      productoId: number,
      tipo: TipoMovInventario,
      cantidad: number,
      nota?: string,
      usuario?: string
    ): Promise<void> =>
      invoke(CANALES.inventario.movimientoProducto, productoId, tipo, cantidad, nota, usuario),
    movimientosProducto: (productoId: number): Promise<MovimientoInventario[]> =>
      invoke(CANALES.inventario.movimientosProducto, productoId)
  },
  gastos: {
    listar: (): Promise<Gasto[]> => invoke(CANALES.gastos.listar),
    crear: (concepto: string, monto: number): Promise<Gasto> =>
      invoke(CANALES.gastos.crear, concepto, monto),
    eliminar: (id: number): Promise<void> => invoke(CANALES.gastos.eliminar, id)
  },
  usuarios: {
    listar: (): Promise<Usuario[]> => invoke(CANALES.usuarios.listar),
    hayUsuarios: (): Promise<boolean> => invoke(CANALES.usuarios.hayUsuarios),
    crearPrimerAdmin: (nombre: string, pin: string): Promise<Usuario> =>
      invoke(CANALES.usuarios.crearPrimerAdmin, nombre, pin),
    login: (usuarioId: number, pin: string): Promise<Usuario | null> =>
      invoke(CANALES.usuarios.login, usuarioId, pin),
    logout: (): Promise<void> => invoke(CANALES.usuarios.logout),
    guardar: (u: UsuarioInput): Promise<Usuario> => invoke(CANALES.usuarios.guardar, u),
    eliminar: (id: number): Promise<void> => invoke(CANALES.usuarios.eliminar, id),
    verificarPinAdmin: (pin: string): Promise<boolean> =>
      invoke(CANALES.usuarios.verificarPinAdmin, pin)
  },
  reimpresiones: {
    listar: (): Promise<Reimpresion[]> => invoke(CANALES.reimpresiones.listar),
    registrar: (
      tipo: Reimpresion['tipo'],
      ordenId: number,
      usuario?: string
    ): Promise<Reimpresion> => invoke(CANALES.reimpresiones.registrar, tipo, ordenId, usuario)
  },
  printer: {
    bytesCocina: (
      titulo: string,
      lineas: DetalleOrden[],
      opciones?: {
        adicional?: boolean
        reimpresion?: boolean
        cancelacion?: boolean
        area?: 'cocina' | 'barra'
      },
      ancho?: number
    ): Promise<number[]> => invoke(CANALES.printer.bytesCocina, titulo, lineas, opciones, ancho),
    bytesFinal: (
      ordenId: number,
      opciones?: { copia?: boolean },
      ancho?: number,
      logoPie?: LogoTicket | null
    ): Promise<number[]> => invoke(CANALES.printer.bytesFinal, ordenId, opciones, ancho, logoPie),
    bytesCorte: (corte: Corte, ancho?: number): Promise<number[]> =>
      invoke(CANALES.printer.bytesCorte, corte, ancho),
    bytesPrueba: (destino: DestinoImpresion, ancho?: number, logoPie?: LogoTicket | null): Promise<number[]> =>
      invoke(CANALES.printer.bytesPrueba, destino, ancho, logoPie),
    listarPuertos: (): Promise<string[]> => invoke(CANALES.printer.listarPuertos),
    enviarCom: (puerto: string, baudRate: number, bytes: number[]): Promise<void> =>
      invoke(CANALES.printer.enviarCom, puerto, baudRate, bytes)
  },
  ble: {
    /** Suscribe a la lista de dispositivos del selector. Devuelve un de-suscriptor. */
    alDetectarDispositivos: (cb: (lista: DispositivoBluetooth[]) => void): (() => void) => {
      const handler = (_e: unknown, lista: DispositivoBluetooth[]): void => cb(lista)
      ipcRenderer.on(CANALES.ble.dispositivos, handler)
      return () => ipcRenderer.removeListener(CANALES.ble.dispositivos, handler)
    },
    /** Informa al main el dispositivo elegido ('' para cancelar). */
    seleccionar: (deviceId: string): void => {
      ipcRenderer.send(CANALES.ble.seleccionar, deviceId)
    }
  },
  config: {
    obtenerImpresoras: (): Promise<ConfigImpresoras> => invoke(CANALES.config.obtenerImpresoras),
    guardarImpresoras: (cfg: ConfigImpresoras): Promise<ConfigImpresoras> =>
      invoke(CANALES.config.guardarImpresoras, cfg)
  },
  respaldo: {
    obtener: (): Promise<ConfigRespaldo> => invoke(CANALES.respaldo.obtener),
    guardar: (cfg: ConfigRespaldo): Promise<ConfigRespaldo> => invoke(CANALES.respaldo.guardar, cfg),
    ahora: (): Promise<string> => invoke(CANALES.respaldo.ahora),
    listar: (): Promise<RespaldoInfo[]> => invoke(CANALES.respaldo.listar),
    elegirCarpeta: (): Promise<string | null> => invoke(CANALES.respaldo.elegirCarpeta),
    abrirCarpeta: (): Promise<string> => invoke(CANALES.respaldo.abrirCarpeta),
    restaurar: (nombre: string): Promise<void> => invoke(CANALES.respaldo.restaurar, nombre)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback sin contextIsolation)
  window.api = api
}

export type Api = typeof api
