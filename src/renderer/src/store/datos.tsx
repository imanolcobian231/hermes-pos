import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type {
  Cancelacion,
  Categoria,
  CategoriaInput,
  CierreCorteInput,
  Cliente,
  ClienteInput,
  Corte,
  DetalleOrden,
  EstadoCaja,
  Gasto,
  GrupoInput,
  GrupoModificador,
  Insumo,
  InsumoInput,
  Mesa,
  MesaInput,
  MetodoPago,
  ModificadorInput,
  OrdenConDetalle,
  Pago,
  Producto,
  ProductoInput,
  Reimpresion,
  ResumenTurno,
  TipoMovInventario
} from '@shared/types'
import { useToast } from '@renderer/components/Toast'

// Re-exportado por compatibilidad con componentes que lo importan de aquí.
export type { OrdenConDetalle } from '@shared/types'

// ---------------------------------------------------------------------------
// Store conectado al backend real vía `window.api` (IPC -> SQLite).
//
// El estado vive en React como caché de lo que hay en la base; cada acción
// llama al backend y luego actualiza la porción de estado afectada.
// ---------------------------------------------------------------------------

// Limpia el mensaje de error de IPC (Electron lo prefija con texto técnico).
function mensajeError(e: unknown): string {
  const crudo = e instanceof Error ? e.message : String(e)
  const partes = crudo.split('Error: ')
  return (partes[partes.length - 1] || crudo).trim() || 'Ocurrió un error'
}

// Manejador de errores fijado por el provider (muestra un toast).
let manejadorError: (e: unknown) => void = () => {}

type ApiType = typeof window.api

// Envuelve cada método de window.api para reportar errores por toast.
// Marca el error como manejado para silenciar el warning de unhandledrejection.
function envolverApi(original: ApiType, onError: (e: unknown) => void): ApiType {
  const salida: Record<string, Record<string, unknown>> = {}
  for (const grupo of Object.keys(original) as (keyof ApiType)[]) {
    const metodos = original[grupo] as Record<string, (...a: unknown[]) => Promise<unknown>>
    salida[grupo as string] = {}
    for (const nombre of Object.keys(metodos)) {
      const fn = metodos[nombre]
      salida[grupo as string][nombre] = async (...args: unknown[]) => {
        try {
          return await fn(...args)
        } catch (e) {
          ;(e as { __manejado?: boolean }).__manejado = true
          onError(e)
          throw e
        }
      }
    }
  }
  return salida as unknown as ApiType
}

const api = envolverApi(window.api, (e) => manejadorError(e))

// Evita el ruido de "unhandledrejection" para errores ya mostrados al usuario.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (ev) => {
    if ((ev.reason as { __manejado?: boolean } | undefined)?.__manejado) ev.preventDefault()
  })
}

const RESUMEN_VACIO: ResumenTurno = {
  totalEfectivo: 0,
  totalTarjeta: 0,
  totalTransferencia: 0,
  totalGastos: 0,
  numOrdenes: 0
}

interface DatosContextValue {
  cargando: boolean
  mesas: Mesa[]
  categorias: Categoria[]
  productos: Producto[]
  grupos: GrupoModificador[]
  ordenes: OrdenConDetalle[]
  cortes: Corte[]
  reimpresiones: Reimpresion[]
  cancelaciones: Cancelacion[]
  resumen: ResumenTurno
  gastos: Gasto[]
  cobradas: OrdenConDetalle[]

  // Mesas
  renombrarMesa: (mesaId: number, nombre: string) => Promise<void>
  editarMesa: (mesaId: number, datos: MesaInput) => Promise<void>
  agregarMesa: (capacidad?: number) => Promise<void>
  eliminarMesa: (mesaId: number) => Promise<void>

  // Órdenes
  ordenDeMesa: (mesaId: number) => OrdenConDetalle | undefined
  ordenPorId: (ordenId: number) => OrdenConDetalle | undefined
  abrirOrden: (mesaId: number) => Promise<OrdenConDetalle>
  abrirOrdenLlevar: () => Promise<OrdenConDetalle>
  descartarOrden: (ordenId: number) => Promise<void>
  agregarProducto: (
    ordenId: number,
    producto: Producto,
    modificadorIds?: number[],
    comensal?: number
  ) => Promise<void>
  cambiarCantidad: (ordenId: number, detalleId: number, delta: number) => Promise<void>
  cambiarNota: (ordenId: number, detalleId: number, nota: string) => Promise<void>
  quitarLinea: (ordenId: number, detalleId: number) => Promise<void>
  enviarACocina: (ordenId: number, comensal?: number) => Promise<DetalleOrden[]>
  marcarPorCobrar: (ordenId: number) => Promise<void>
  cobrarOrden: (
    ordenId: number,
    pagos: Pago[],
    efectivoRecibido?: number,
    descuento?: number,
    pin?: string
  ) => Promise<void>
  cancelarOrden: (ordenId: number, motivo: string, usuario?: string, pin?: string) => Promise<void>
  /** Devuelve (revierte) una venta cobrada del turno actual. */
  devolverOrden: (ordenId: number, motivo: string, usuario?: string, pin?: string) => Promise<void>
  /** Fía la orden: la carga a la cuenta de crédito de un cliente. */
  fiarOrden: (ordenId: number, clienteId: number, descuento?: number) => Promise<void>
  registrarReimpresion: (
    tipo: Reimpresion['tipo'],
    ordenId: number,
    usuario?: string
  ) => Promise<void>

  // Clientes / créditos
  clientes: Cliente[]
  guardarCliente: (cliente: ClienteInput) => Promise<void>
  eliminarCliente: (clienteId: number) => Promise<void>
  abonarCredito: (clienteId: number, monto: number, metodo: MetodoPago, nota?: string) => Promise<void>

  // Inventario
  insumos: Insumo[]
  guardarInsumo: (insumo: InsumoInput) => Promise<void>
  eliminarInsumo: (insumoId: number) => Promise<void>
  movimientoInventario: (
    insumoId: number,
    tipo: TipoMovInventario,
    cantidad: number,
    nota?: string,
    usuario?: string
  ) => Promise<void>

  // Catálogo
  guardarProducto: (producto: ProductoInput) => Promise<void>
  eliminarProducto: (productoId: number) => Promise<void>
  guardarCategoria: (categoria: CategoriaInput) => Promise<void>
  eliminarCategoria: (categoriaId: number) => Promise<void>
  guardarGrupo: (grupo: GrupoInput) => Promise<void>
  eliminarGrupo: (grupoId: number) => Promise<void>
  guardarModificador: (modificador: ModificadorInput) => Promise<void>
  eliminarModificador: (modificadorId: number) => Promise<void>
  asignarGrupo: (productoId: number, grupoId: number) => Promise<void>
  desasignarGrupo: (productoId: number, grupoId: number) => Promise<void>

  // Corte / caja
  caja: EstadoCaja
  abrirCaja: (fondoInicial: number) => Promise<void>
  cerrarCorte: (cuadre?: CierreCorteInput) => Promise<Corte>

  // Finanzas
  agregarGasto: (concepto: string, monto: number) => Promise<void>
  eliminarGasto: (gastoId: number) => Promise<void>
}

const DatosContext = createContext<DatosContextValue | null>(null)

export function ProveedorDatos({ children }: { children: ReactNode }): React.JSX.Element {
  const toast = useToast()
  // Conecta los errores de IPC con el sistema de notificaciones.
  useEffect(() => {
    manejadorError = (e) => toast(mensajeError(e), 'error')
    return () => {
      manejadorError = () => {}
    }
  }, [toast])

  const [cargando, setCargando] = useState(true)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [grupos, setGrupos] = useState<GrupoModificador[]>([])
  const [ordenes, setOrdenes] = useState<OrdenConDetalle[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [reimpresiones, setReimpresiones] = useState<Reimpresion[]>([])
  const [cancelaciones, setCancelaciones] = useState<Cancelacion[]>([])
  const [resumen, setResumen] = useState<ResumenTurno>(RESUMEN_VACIO)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cobradas, setCobradas] = useState<OrdenConDetalle[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [caja, setCaja] = useState<EstadoCaja>({ abierta: false, fondoInicial: 0, abiertoEn: null })

  // --- Refrescos puntuales -------------------------------------------------
  const refrescarMesas = useCallback(async () => setMesas(await api.mesas.listar()), [])
  const refrescarOrdenes = useCallback(async () => setOrdenes(await api.ordenes.activas()), [])
  const refrescarCortes = useCallback(async () => setCortes(await api.cortes.listar()), [])
  const refrescarResumen = useCallback(async () => setResumen(await api.cortes.resumen()), [])
  const refrescarGastos = useCallback(async () => setGastos(await api.gastos.listar()), [])
  const refrescarCobradas = useCallback(
    async () => setCobradas(await api.ordenes.cobradasTurno()),
    []
  )
  const refrescarReimpresiones = useCallback(
    async () => setReimpresiones(await api.reimpresiones.listar()),
    []
  )
  const refrescarCancelaciones = useCallback(
    async () => setCancelaciones(await api.cancelaciones.listar()),
    []
  )
  const refrescarClientes = useCallback(async () => setClientes(await api.clientes.listar()), [])
  const refrescarCaja = useCallback(async () => setCaja(await api.cortes.estadoCaja()), [])
  const refrescarInsumos = useCallback(async () => setInsumos(await api.inventario.listar()), [])
  const refrescarCatalogo = useCallback(async () => {
    const [cats, prods, grps] = await Promise.all([
      api.catalogo.categorias(),
      api.catalogo.productos(),
      api.catalogo.grupos()
    ])
    setCategorias(cats)
    setProductos(prods)
    setGrupos(grps)
  }, [])

  // Inserta/actualiza una orden en la caché (la quita si ya no está activa).
  const aplicarOrden = useCallback((o: OrdenConDetalle) => {
    setOrdenes((prev) => {
      const resto = prev.filter((x) => x.id !== o.id)
      return o.estado === 'abierta' ? [...resto, o] : resto
    })
  }, [])

  // --- Carga inicial -------------------------------------------------------
  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const [m, cats, prods, grps, ords, crts, reimp, canc, res, gas, cob, clis, cja, ins] =
          await Promise.all([
            api.mesas.listar(),
            api.catalogo.categorias(),
            api.catalogo.productos(),
            api.catalogo.grupos(),
            api.ordenes.activas(),
            api.cortes.listar(),
            api.reimpresiones.listar(),
            api.cancelaciones.listar(),
            api.cortes.resumen(),
            api.gastos.listar(),
            api.ordenes.cobradasTurno(),
            api.clientes.listar(),
            api.cortes.estadoCaja(),
            api.inventario.listar()
          ])
        if (!activo) return
        setMesas(m)
        setCategorias(cats)
        setProductos(prods)
        setGrupos(grps)
        setOrdenes(ords)
        setCortes(crts)
        setReimpresiones(reimp)
        setCancelaciones(canc)
        setResumen(res)
        setGastos(gas)
        setCobradas(cob)
        setClientes(clis)
        setCaja(cja)
        setInsumos(ins)
      } finally {
        // Aunque falle algo, sale de la pantalla de carga (el error ya se notificó).
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [])

  // --- Mesas ---------------------------------------------------------------
  const renombrarMesa = useCallback(
    async (mesaId: number, nombre: string) => {
      await api.mesas.renombrar(mesaId, nombre)
      await refrescarMesas()
    },
    [refrescarMesas]
  )

  const editarMesa = useCallback(
    async (mesaId: number, datos: MesaInput) => {
      await api.mesas.editar(mesaId, datos)
      await refrescarMesas()
    },
    [refrescarMesas]
  )

  const agregarMesa = useCallback(
    async (capacidad?: number) => {
      await api.mesas.crear(capacidad)
      await refrescarMesas()
    },
    [refrescarMesas]
  )

  const eliminarMesa = useCallback(
    async (mesaId: number) => {
      await api.mesas.eliminar(mesaId)
      await refrescarMesas()
    },
    [refrescarMesas]
  )

  // --- Órdenes -------------------------------------------------------------
  const ordenDeMesa = useCallback(
    (mesaId: number): OrdenConDetalle | undefined =>
      ordenes.find((o) => o.mesaId === mesaId && o.estado === 'abierta'),
    [ordenes]
  )

  const ordenPorId = useCallback(
    (ordenId: number): OrdenConDetalle | undefined => ordenes.find((o) => o.id === ordenId),
    [ordenes]
  )

  const abrirOrden = useCallback(
    async (mesaId: number): Promise<OrdenConDetalle> => {
      const orden = await api.ordenes.abrir(mesaId)
      aplicarOrden(orden)
      await refrescarMesas()
      return orden
    },
    [aplicarOrden, refrescarMesas]
  )

  const abrirOrdenLlevar = useCallback(async (): Promise<OrdenConDetalle> => {
    const orden = await api.ordenes.abrirLlevar()
    aplicarOrden(orden)
    return orden
  }, [aplicarOrden])

  const descartarOrden = useCallback(
    async (ordenId: number) => {
      await api.ordenes.descartar(ordenId)
      setOrdenes((prev) => prev.filter((o) => o.id !== ordenId))
      await refrescarMesas()
    },
    [refrescarMesas]
  )

  const agregarProducto = useCallback(
    async (ordenId: number, producto: Producto, modificadorIds?: number[], comensal?: number) => {
      aplicarOrden(
        await api.ordenes.agregarProducto(ordenId, producto.id, modificadorIds, comensal)
      )
    },
    [aplicarOrden]
  )

  const cambiarCantidad = useCallback(
    async (ordenId: number, detalleId: number, delta: number) => {
      aplicarOrden(await api.ordenes.cambiarCantidad(ordenId, detalleId, delta))
    },
    [aplicarOrden]
  )

  const cambiarNota = useCallback(
    async (ordenId: number, detalleId: number, nota: string) => {
      aplicarOrden(await api.ordenes.cambiarNota(ordenId, detalleId, nota))
    },
    [aplicarOrden]
  )

  const quitarLinea = useCallback(
    async (ordenId: number, detalleId: number) => {
      aplicarOrden(await api.ordenes.quitarLinea(ordenId, detalleId))
    },
    [aplicarOrden]
  )

  const enviarACocina = useCallback(
    async (ordenId: number, comensal?: number): Promise<DetalleOrden[]> => {
      const nuevas = await api.ordenes.enviarCocina(ordenId, comensal)
      await refrescarOrdenes()
      return nuevas
    },
    [refrescarOrdenes]
  )

  const marcarPorCobrar = useCallback(
    async (ordenId: number) => {
      aplicarOrden(await api.ordenes.marcarPorCobrar(ordenId))
      await refrescarMesas()
    },
    [aplicarOrden, refrescarMesas]
  )

  const cobrarOrden = useCallback(
    async (ordenId: number, pagos: Pago[], efectivoRecibido?: number, descuento?: number, pin?: string) => {
      await api.ordenes.cobrar(ordenId, pagos, efectivoRecibido, descuento, pin)
      await Promise.all([
        refrescarOrdenes(),
        refrescarMesas(),
        refrescarResumen(),
        refrescarCobradas(),
        refrescarCatalogo()
      ])
    },
    [refrescarOrdenes, refrescarMesas, refrescarResumen, refrescarCobradas, refrescarCatalogo]
  )

  const cancelarOrden = useCallback(
    async (ordenId: number, motivo: string, usuario?: string, pin?: string) => {
      await api.ordenes.cancelar(ordenId, motivo, usuario, pin)
      await Promise.all([refrescarOrdenes(), refrescarMesas(), refrescarCancelaciones()])
    },
    [refrescarOrdenes, refrescarMesas, refrescarCancelaciones]
  )

  const devolverOrden = useCallback(
    async (ordenId: number, motivo: string, usuario?: string, pin?: string) => {
      await api.ordenes.devolver(ordenId, motivo, usuario, pin)
      await Promise.all([
        refrescarResumen(),
        refrescarCobradas(),
        refrescarCancelaciones(),
        refrescarClientes(),
        refrescarCatalogo()
      ])
    },
    [refrescarResumen, refrescarCobradas, refrescarCancelaciones, refrescarClientes, refrescarCatalogo]
  )

  const fiarOrden = useCallback(
    async (ordenId: number, clienteId: number, descuento?: number) => {
      await api.ordenes.fiar(ordenId, clienteId, descuento)
      await Promise.all([
        refrescarOrdenes(),
        refrescarMesas(),
        refrescarResumen(),
        refrescarCobradas(),
        refrescarClientes(),
        refrescarCatalogo()
      ])
    },
    [refrescarOrdenes, refrescarMesas, refrescarResumen, refrescarCobradas, refrescarClientes, refrescarCatalogo]
  )

  const registrarReimpresion = useCallback(
    async (tipo: Reimpresion['tipo'], ordenId: number, usuario?: string) => {
      await api.reimpresiones.registrar(tipo, ordenId, usuario)
      await refrescarReimpresiones()
    },
    [refrescarReimpresiones]
  )

  // --- Clientes / créditos -------------------------------------------------
  const guardarCliente = useCallback(
    async (cliente: ClienteInput) => {
      await api.clientes.guardar(cliente)
      await refrescarClientes()
    },
    [refrescarClientes]
  )

  const eliminarCliente = useCallback(
    async (clienteId: number) => {
      await api.clientes.eliminar(clienteId)
      await refrescarClientes()
    },
    [refrescarClientes]
  )

  const abonarCredito = useCallback(
    async (clienteId: number, monto: number, metodo: MetodoPago, nota?: string) => {
      await api.clientes.abonar(clienteId, monto, metodo, nota)
      await Promise.all([refrescarClientes(), refrescarResumen()])
    },
    [refrescarClientes, refrescarResumen]
  )

  // --- Inventario ----------------------------------------------------------
  const guardarInsumo = useCallback(
    async (insumo: InsumoInput) => {
      await api.inventario.guardar(insumo)
      await refrescarInsumos()
    },
    [refrescarInsumos]
  )

  const eliminarInsumo = useCallback(
    async (insumoId: number) => {
      await api.inventario.eliminar(insumoId)
      await refrescarInsumos()
    },
    [refrescarInsumos]
  )

  const movimientoInventario = useCallback(
    async (
      insumoId: number,
      tipo: TipoMovInventario,
      cantidad: number,
      nota?: string,
      usuario?: string
    ) => {
      await api.inventario.movimiento(insumoId, tipo, cantidad, nota, usuario)
      await refrescarInsumos()
    },
    [refrescarInsumos]
  )

  // --- Catálogo ------------------------------------------------------------
  const guardarProducto = useCallback(
    async (producto: ProductoInput) => {
      await api.catalogo.guardarProducto(producto)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const eliminarProducto = useCallback(
    async (productoId: number) => {
      await api.catalogo.eliminarProducto(productoId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const guardarCategoria = useCallback(
    async (categoria: CategoriaInput) => {
      await api.catalogo.guardarCategoria(categoria)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const eliminarCategoria = useCallback(
    async (categoriaId: number) => {
      await api.catalogo.eliminarCategoria(categoriaId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const guardarGrupo = useCallback(
    async (grupo: GrupoInput) => {
      await api.catalogo.guardarGrupo(grupo)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const eliminarGrupo = useCallback(
    async (grupoId: number) => {
      await api.catalogo.eliminarGrupo(grupoId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const guardarModificador = useCallback(
    async (modificador: ModificadorInput) => {
      await api.catalogo.guardarModificador(modificador)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const eliminarModificador = useCallback(
    async (modificadorId: number) => {
      await api.catalogo.eliminarModificador(modificadorId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const asignarGrupo = useCallback(
    async (productoId: number, grupoId: number) => {
      await api.catalogo.asignarGrupo(productoId, grupoId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  const desasignarGrupo = useCallback(
    async (productoId: number, grupoId: number) => {
      await api.catalogo.desasignarGrupo(productoId, grupoId)
      await refrescarCatalogo()
    },
    [refrescarCatalogo]
  )

  // --- Corte / caja --------------------------------------------------------
  const abrirCaja = useCallback(
    async (fondoInicial: number) => {
      await api.cortes.abrirCaja(fondoInicial)
      await refrescarCaja()
    },
    [refrescarCaja]
  )

  const cerrarCorte = useCallback(
    async (cuadre?: CierreCorteInput): Promise<Corte> => {
      const corte = await api.cortes.cerrar(cuadre)
      await Promise.all([
        refrescarCortes(),
        refrescarResumen(),
        refrescarGastos(),
        refrescarCobradas(),
        refrescarCancelaciones(),
        refrescarCaja()
      ])
      return corte
    },
    [
      refrescarCortes,
      refrescarResumen,
      refrescarGastos,
      refrescarCobradas,
      refrescarCancelaciones,
      refrescarCaja
    ]
  )

  // --- Finanzas ------------------------------------------------------------
  const agregarGasto = useCallback(
    async (concepto: string, monto: number) => {
      await api.gastos.crear(concepto, monto)
      await Promise.all([refrescarGastos(), refrescarResumen()])
    },
    [refrescarGastos, refrescarResumen]
  )

  const eliminarGasto = useCallback(
    async (gastoId: number) => {
      await api.gastos.eliminar(gastoId)
      await Promise.all([refrescarGastos(), refrescarResumen()])
    },
    [refrescarGastos, refrescarResumen]
  )

  const valor = useMemo<DatosContextValue>(
    () => ({
      cargando,
      mesas,
      categorias,
      productos,
      grupos,
      ordenes,
      cortes,
      reimpresiones,
      cancelaciones,
      resumen,
      gastos,
      cobradas,
      renombrarMesa,
      editarMesa,
      agregarMesa,
      eliminarMesa,
      ordenDeMesa,
      ordenPorId,
      abrirOrden,
      abrirOrdenLlevar,
      descartarOrden,
      agregarProducto,
      cambiarCantidad,
      cambiarNota,
      quitarLinea,
      enviarACocina,
      marcarPorCobrar,
      cobrarOrden,
      cancelarOrden,
      devolverOrden,
      fiarOrden,
      registrarReimpresion,
      clientes,
      guardarCliente,
      eliminarCliente,
      abonarCredito,
      insumos,
      guardarInsumo,
      eliminarInsumo,
      movimientoInventario,
      guardarProducto,
      eliminarProducto,
      guardarCategoria,
      eliminarCategoria,
      guardarGrupo,
      eliminarGrupo,
      guardarModificador,
      eliminarModificador,
      asignarGrupo,
      desasignarGrupo,
      caja,
      abrirCaja,
      cerrarCorte,
      agregarGasto,
      eliminarGasto
    }),
    [
      cargando,
      mesas,
      categorias,
      productos,
      grupos,
      ordenes,
      cortes,
      reimpresiones,
      cancelaciones,
      resumen,
      gastos,
      cobradas,
      renombrarMesa,
      editarMesa,
      agregarMesa,
      eliminarMesa,
      ordenDeMesa,
      ordenPorId,
      abrirOrden,
      abrirOrdenLlevar,
      descartarOrden,
      agregarProducto,
      cambiarCantidad,
      cambiarNota,
      quitarLinea,
      enviarACocina,
      marcarPorCobrar,
      cobrarOrden,
      cancelarOrden,
      devolverOrden,
      fiarOrden,
      registrarReimpresion,
      clientes,
      guardarCliente,
      eliminarCliente,
      abonarCredito,
      insumos,
      guardarInsumo,
      eliminarInsumo,
      movimientoInventario,
      guardarProducto,
      eliminarProducto,
      guardarCategoria,
      eliminarCategoria,
      guardarGrupo,
      eliminarGrupo,
      guardarModificador,
      eliminarModificador,
      asignarGrupo,
      desasignarGrupo,
      caja,
      abrirCaja,
      cerrarCorte,
      agregarGasto,
      eliminarGasto
    ]
  )

  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

export function useDatos(): DatosContextValue {
  const ctx = useContext(DatosContext)
  if (!ctx) throw new Error('useDatos debe usarse dentro de <ProveedorDatos>')
  return ctx
}
