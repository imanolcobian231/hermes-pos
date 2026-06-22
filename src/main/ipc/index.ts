import { ipcMain } from 'electron'
import { CANALES } from '@shared/canales'
import type {
  CategoriaInput,
  DetalleOrden,
  GrupoInput,
  MesaInput,
  MetodoPago,
  ModificadorInput,
  ProductoInput,
  Reimpresion
} from '@shared/types'
import * as mesas from '../repos/mesas'
import * as catalogo from '../repos/catalogo'
import * as ordenes from '../repos/ordenes'
import * as cortes from '../repos/cortes'
import * as gastos from '../repos/gastos'
import * as reimpresiones from '../repos/reimpresiones'
import { imprimirCocina, imprimirFinal } from '../printer/tickets'

/** Registra todos los handlers IPC. Llamar una sola vez tras inicializar la DB. */
export function registrarIpc(): void {
  // --- Mesas ---------------------------------------------------------------
  ipcMain.handle(CANALES.mesas.listar, () => mesas.listar())
  ipcMain.handle(CANALES.mesas.crear, (_e, capacidad?: number) => mesas.crear(capacidad))
  ipcMain.handle(CANALES.mesas.editar, (_e, id: number, datos: MesaInput) => mesas.editar(id, datos))
  ipcMain.handle(CANALES.mesas.renombrar, (_e, id: number, nombre: string) =>
    mesas.renombrar(id, nombre)
  )
  ipcMain.handle(CANALES.mesas.eliminar, (_e, id: number) => mesas.eliminar(id))

  // --- Catálogo ------------------------------------------------------------
  ipcMain.handle(CANALES.catalogo.categorias, () => catalogo.listarCategorias())
  ipcMain.handle(CANALES.catalogo.guardarCategoria, (_e, cat: CategoriaInput) =>
    catalogo.guardarCategoria(cat)
  )
  ipcMain.handle(CANALES.catalogo.eliminarCategoria, (_e, id: number) =>
    catalogo.eliminarCategoria(id)
  )
  ipcMain.handle(CANALES.catalogo.productos, () => catalogo.listarProductos())
  ipcMain.handle(CANALES.catalogo.guardarProducto, (_e, prod: ProductoInput) =>
    catalogo.guardarProducto(prod)
  )
  ipcMain.handle(CANALES.catalogo.eliminarProducto, (_e, id: number) =>
    catalogo.eliminarProducto(id)
  )
  ipcMain.handle(CANALES.catalogo.grupos, () => catalogo.listarGrupos())
  ipcMain.handle(CANALES.catalogo.guardarGrupo, (_e, g: GrupoInput) => catalogo.guardarGrupo(g))
  ipcMain.handle(CANALES.catalogo.eliminarGrupo, (_e, id: number) => catalogo.eliminarGrupo(id))
  ipcMain.handle(CANALES.catalogo.guardarModificador, (_e, m: ModificadorInput) =>
    catalogo.guardarModificador(m)
  )
  ipcMain.handle(CANALES.catalogo.eliminarModificador, (_e, id: number) =>
    catalogo.eliminarModificador(id)
  )
  ipcMain.handle(CANALES.catalogo.asignarGrupo, (_e, productoId: number, grupoId: number) =>
    catalogo.asignarGrupo(productoId, grupoId)
  )
  ipcMain.handle(CANALES.catalogo.desasignarGrupo, (_e, productoId: number, grupoId: number) =>
    catalogo.desasignarGrupo(productoId, grupoId)
  )

  // --- Órdenes -------------------------------------------------------------
  ipcMain.handle(CANALES.ordenes.activas, () => ordenes.listarActivas())
  ipcMain.handle(CANALES.ordenes.deMesa, (_e, mesaId: number) => ordenes.ordenDeMesa(mesaId))
  ipcMain.handle(CANALES.ordenes.abrir, (_e, mesaId: number) => ordenes.abrir(mesaId))
  ipcMain.handle(CANALES.ordenes.abrirLlevar, () => ordenes.abrirLlevar())
  ipcMain.handle(CANALES.ordenes.descartar, (_e, ordenId: number) => ordenes.descartar(ordenId))
  ipcMain.handle(
    CANALES.ordenes.agregarProducto,
    (_e, ordenId: number, productoId: number, modificadorIds?: number[], comensal?: number) =>
      ordenes.agregarProducto(ordenId, productoId, modificadorIds, comensal)
  )
  ipcMain.handle(CANALES.ordenes.cambiarCantidad, (_e, ordenId: number, detalleId: number, delta: number) =>
    ordenes.cambiarCantidad(ordenId, detalleId, delta)
  )
  ipcMain.handle(CANALES.ordenes.cambiarNota, (_e, ordenId: number, detalleId: number, nota: string) =>
    ordenes.cambiarNota(ordenId, detalleId, nota)
  )
  ipcMain.handle(CANALES.ordenes.quitarLinea, (_e, ordenId: number, detalleId: number) =>
    ordenes.quitarLinea(ordenId, detalleId)
  )
  ipcMain.handle(CANALES.ordenes.enviarCocina, (_e, ordenId: number, comensal?: number) =>
    ordenes.enviarACocina(ordenId, comensal)
  )
  ipcMain.handle(CANALES.ordenes.marcarPorCobrar, (_e, ordenId: number) =>
    ordenes.marcarPorCobrar(ordenId)
  )
  ipcMain.handle(
    CANALES.ordenes.cobrar,
    (_e, ordenId: number, metodo: MetodoPago, monto: number, descuento?: number) =>
      ordenes.cobrar(ordenId, metodo, monto, descuento)
  )
  ipcMain.handle(CANALES.ordenes.cancelar, (_e, ordenId: number) => ordenes.cancelar(ordenId))
  ipcMain.handle(CANALES.ordenes.cobradasTurno, () => ordenes.cobradasTurno())

  // --- Cortes --------------------------------------------------------------
  ipcMain.handle(CANALES.cortes.resumen, () => cortes.resumenTurno())
  ipcMain.handle(CANALES.cortes.listar, () => cortes.listar())
  ipcMain.handle(CANALES.cortes.cerrar, () => cortes.cerrar())

  // --- Gastos --------------------------------------------------------------
  ipcMain.handle(CANALES.gastos.listar, () => gastos.listarTurno())
  ipcMain.handle(CANALES.gastos.crear, (_e, concepto: string, monto: number) =>
    gastos.crear(concepto, monto)
  )
  ipcMain.handle(CANALES.gastos.eliminar, (_e, id: number) => gastos.eliminar(id))

  // --- Reimpresiones -------------------------------------------------------
  ipcMain.handle(CANALES.reimpresiones.listar, () => reimpresiones.listar())
  ipcMain.handle(
    CANALES.reimpresiones.registrar,
    (_e, tipo: Reimpresion['tipo'], ordenId: number, usuario?: string) =>
      reimpresiones.registrar(tipo, ordenId, usuario)
  )

  // --- Impresión (simulación) ----------------------------------------------
  ipcMain.handle(
    CANALES.printer.cocina,
    (_e, titulo: string, lineas: DetalleOrden[], opciones?: { adicional?: boolean; reimpresion?: boolean }) =>
      imprimirCocina(titulo, lineas, opciones)
  )
  ipcMain.handle(CANALES.printer.final, (_e, ordenId: number, opciones?: { copia?: boolean }) => {
    const orden = ordenes.obtenerConDetalle(ordenId)
    const titulo = orden.mesaId != null ? mesas.obtener(orden.mesaId).nombre : orden.nombre ?? 'Pedido'
    return imprimirFinal(titulo, orden, opciones)
  })
}
