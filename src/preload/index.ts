import { contextBridge, ipcRenderer } from 'electron'
import { CANALES } from '@shared/canales'
import type {
  Categoria,
  CategoriaInput,
  Corte,
  DetalleOrden,
  Gasto,
  GrupoInput,
  GrupoModificador,
  Mesa,
  MesaInput,
  MetodoPago,
  Modificador,
  ModificadorInput,
  OrdenConDetalle,
  Producto,
  ProductoInput,
  Reimpresion,
  ResumenTurno
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
      invoke(CANALES.catalogo.desasignarGrupo, productoId, grupoId)
  },
  ordenes: {
    activas: (): Promise<OrdenConDetalle[]> => invoke(CANALES.ordenes.activas),
    deMesa: (mesaId: number): Promise<OrdenConDetalle | undefined> =>
      invoke(CANALES.ordenes.deMesa, mesaId),
    abrir: (mesaId: number): Promise<OrdenConDetalle> => invoke(CANALES.ordenes.abrir, mesaId),
    abrirLlevar: (): Promise<OrdenConDetalle> => invoke(CANALES.ordenes.abrirLlevar),
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
      metodo: MetodoPago,
      monto: number,
      descuento?: number
    ): Promise<OrdenConDetalle> => invoke(CANALES.ordenes.cobrar, ordenId, metodo, monto, descuento),
    cancelar: (ordenId: number): Promise<void> => invoke(CANALES.ordenes.cancelar, ordenId),
    cobradasTurno: (): Promise<OrdenConDetalle[]> => invoke(CANALES.ordenes.cobradasTurno)
  },
  cortes: {
    resumen: (): Promise<ResumenTurno> => invoke(CANALES.cortes.resumen),
    listar: (): Promise<Corte[]> => invoke(CANALES.cortes.listar),
    cerrar: (): Promise<Corte> => invoke(CANALES.cortes.cerrar)
  },
  gastos: {
    listar: (): Promise<Gasto[]> => invoke(CANALES.gastos.listar),
    crear: (concepto: string, monto: number): Promise<Gasto> =>
      invoke(CANALES.gastos.crear, concepto, monto),
    eliminar: (id: number): Promise<void> => invoke(CANALES.gastos.eliminar, id)
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
    cocina: (
      titulo: string,
      lineas: DetalleOrden[],
      opciones?: { adicional?: boolean; reimpresion?: boolean }
    ): Promise<string> => invoke(CANALES.printer.cocina, titulo, lineas, opciones),
    final: (ordenId: number, opciones?: { copia?: boolean }): Promise<string> =>
      invoke(CANALES.printer.final, ordenId, opciones)
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
