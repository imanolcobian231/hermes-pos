import { ipcMain, dialog, shell } from 'electron'
import { CANALES } from '@shared/canales'
import type {
  CategoriaInput,
  CierreCorteInput,
  ClienteInput,
  ConfigImpresoras,
  ConfigRespaldo,
  DestinoImpresion,
  DetalleOrden,
  GrupoInput,
  MesaInput,
  MetodoPago,
  ModificadorInput,
  Pago,
  ProductoInput,
  Reimpresion,
  UsuarioInput
} from '@shared/types'
import * as mesas from '../repos/mesas'
import * as catalogo from '../repos/catalogo'
import * as ordenes from '../repos/ordenes'
import * as cortes from '../repos/cortes'
import * as gastos from '../repos/gastos'
import * as cancelaciones from '../repos/cancelaciones'
import * as creditos from '../repos/creditos'
import * as reportes from '../repos/reportes'
import * as usuarios from '../repos/usuarios'
import * as reimpresiones from '../repos/reimpresiones'
import * as config from '../repos/config'
import { bytesCocina, bytesFinal, bytesPrueba } from '../printer/tickets'
import { listarPuertos, enviarAPuerto } from '../printer/serial'
import { respaldar, listarRespaldos, carpetaRespaldos } from '../db/respaldo'

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
    (_e, ordenId: number, pagos: Pago[], efectivoRecibido?: number, descuento?: number) =>
      ordenes.cobrar(ordenId, pagos, efectivoRecibido, descuento)
  )
  ipcMain.handle(CANALES.ordenes.fiar, (_e, ordenId: number, clienteId: number, descuento?: number) =>
    ordenes.fiar(ordenId, clienteId, descuento)
  )
  ipcMain.handle(CANALES.ordenes.cancelar, (_e, ordenId: number, motivo: string, usuario?: string) =>
    ordenes.cancelar(ordenId, motivo, usuario)
  )
  ipcMain.handle(CANALES.ordenes.cobradasTurno, () => ordenes.cobradasTurno())

  // --- Clientes / créditos -------------------------------------------------
  ipcMain.handle(CANALES.clientes.listar, () => creditos.listarClientes())
  ipcMain.handle(CANALES.clientes.guardar, (_e, c: ClienteInput) => creditos.guardarCliente(c))
  ipcMain.handle(CANALES.clientes.eliminar, (_e, id: number) => creditos.eliminarCliente(id))
  ipcMain.handle(CANALES.clientes.movimientos, (_e, clienteId: number) =>
    creditos.movimientosDe(clienteId)
  )
  ipcMain.handle(
    CANALES.clientes.abonar,
    (_e, clienteId: number, monto: number, metodo: MetodoPago, nota?: string) =>
      creditos.registrarAbono(clienteId, monto, metodo, nota)
  )

  // --- Cortes --------------------------------------------------------------
  ipcMain.handle(CANALES.cortes.resumen, () => cortes.resumenTurno())
  ipcMain.handle(CANALES.cortes.listar, () => cortes.listar())
  ipcMain.handle(CANALES.cortes.cerrar, (_e, cuadre?: CierreCorteInput) => cortes.cerrar(cuadre))

  // --- Cancelaciones (auditoría) -------------------------------------------
  ipcMain.handle(CANALES.cancelaciones.listar, () => cancelaciones.listarTurno())

  // --- Reportes históricos -------------------------------------------------
  ipcMain.handle(CANALES.reportes.generar, (_e, desde: string, hasta: string) =>
    reportes.generar(desde, hasta)
  )

  // --- Gastos --------------------------------------------------------------
  ipcMain.handle(CANALES.gastos.listar, () => gastos.listarTurno())
  ipcMain.handle(CANALES.gastos.crear, (_e, concepto: string, monto: number) =>
    gastos.crear(concepto, monto)
  )
  ipcMain.handle(CANALES.gastos.eliminar, (_e, id: number) => gastos.eliminar(id))

  // --- Usuarios ------------------------------------------------------------
  ipcMain.handle(CANALES.usuarios.listar, () => usuarios.listar())
  ipcMain.handle(CANALES.usuarios.hayUsuarios, () => usuarios.hayUsuarios())
  ipcMain.handle(CANALES.usuarios.crearPrimerAdmin, (_e, nombre: string, pin: string) =>
    usuarios.crearPrimerAdmin(nombre, pin)
  )
  ipcMain.handle(CANALES.usuarios.login, (_e, usuarioId: number, pin: string) =>
    usuarios.login(usuarioId, pin)
  )
  ipcMain.handle(CANALES.usuarios.guardar, (_e, u: UsuarioInput) => usuarios.guardar(u))
  ipcMain.handle(CANALES.usuarios.eliminar, (_e, id: number) => usuarios.eliminar(id))

  // --- Reimpresiones -------------------------------------------------------
  ipcMain.handle(CANALES.reimpresiones.listar, () => reimpresiones.listar())
  ipcMain.handle(
    CANALES.reimpresiones.registrar,
    (_e, tipo: Reimpresion['tipo'], ordenId: number, usuario?: string) =>
      reimpresiones.registrar(tipo, ordenId, usuario)
  )

  // --- Impresión: el main arma los bytes ESC/POS; el renderer los envía por BLE.
  ipcMain.handle(
    CANALES.printer.bytesCocina,
    (_e, titulo: string, lineas: DetalleOrden[], opciones?: { adicional?: boolean; reimpresion?: boolean }) =>
      bytesCocina(titulo, lineas, opciones)
  )
  ipcMain.handle(CANALES.printer.bytesFinal, (_e, ordenId: number, opciones?: { copia?: boolean }) => {
    const orden = ordenes.obtenerConDetalle(ordenId)
    const titulo = orden.mesaId != null ? mesas.obtener(orden.mesaId).nombre : orden.nombre ?? 'Pedido'
    return bytesFinal(titulo, orden, opciones)
  })
  ipcMain.handle(CANALES.printer.bytesPrueba, (_e, destino: DestinoImpresion) => bytesPrueba(destino))
  ipcMain.handle(CANALES.printer.listarPuertos, () => listarPuertos())
  ipcMain.handle(CANALES.printer.enviarCom, (_e, puerto: string, baudRate: number, bytes: number[]) =>
    enviarAPuerto(puerto, baudRate, bytes)
  )

  // --- Configuración -------------------------------------------------------
  ipcMain.handle(CANALES.config.obtenerImpresoras, () => config.obtenerImpresoras())
  ipcMain.handle(CANALES.config.guardarImpresoras, (_e, cfg: ConfigImpresoras) =>
    config.guardarImpresoras(cfg)
  )

  // --- Respaldo de la base de datos ----------------------------------------
  ipcMain.handle(CANALES.respaldo.obtener, () => config.obtenerRespaldo())
  ipcMain.handle(CANALES.respaldo.guardar, (_e, cfg: ConfigRespaldo) => config.guardarRespaldo(cfg))
  ipcMain.handle(CANALES.respaldo.ahora, () => respaldar())
  ipcMain.handle(CANALES.respaldo.listar, () => listarRespaldos())
  ipcMain.handle(CANALES.respaldo.abrirCarpeta, () => shell.openPath(carpetaRespaldos()))
  ipcMain.handle(CANALES.respaldo.elegirCarpeta, async () => {
    const r = await dialog.showOpenDialog({
      title: 'Carpeta para los respaldos',
      properties: ['openDirectory', 'createDirectory']
    })
    if (r.canceled || r.filePaths.length === 0) return null
    const carpeta = r.filePaths[0]
    config.guardarRespaldo({ ...config.obtenerRespaldo(), carpeta })
    return carpeta
  })
}
