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
  Categoria,
  CategoriaInput,
  Corte,
  DetalleOrden,
  GrupoInput,
  Mesa,
  MesaInput,
  MetodoPago,
  ModificadorInput,
  OrdenConDetalle,
  Producto,
  ProductoInput,
  Reimpresion,
  ResumenTurno
} from '@shared/types'

// Re-exportado por compatibilidad con componentes que lo importan de aquí.
export type { OrdenConDetalle } from '@shared/types'

// ---------------------------------------------------------------------------
// Store conectado al backend real vía `window.api` (IPC -> SQLite).
//
// El estado vive en React como caché de lo que hay en la base; cada acción
// llama al backend y luego actualiza la porción de estado afectada.
// ---------------------------------------------------------------------------

const api = window.api

const RESUMEN_VACIO: ResumenTurno = {
  totalEfectivo: 0,
  totalTarjeta: 0,
  totalTransferencia: 0,
  numOrdenes: 0
}

interface DatosContextValue {
  cargando: boolean
  mesas: Mesa[]
  categorias: Categoria[]
  productos: Producto[]
  ordenes: OrdenConDetalle[]
  cortes: Corte[]
  reimpresiones: Reimpresion[]
  resumen: ResumenTurno

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
    modificadorIds?: number[]
  ) => Promise<void>
  cambiarCantidad: (ordenId: number, detalleId: number, delta: number) => Promise<void>
  cambiarNota: (ordenId: number, detalleId: number, nota: string) => Promise<void>
  quitarLinea: (ordenId: number, detalleId: number) => Promise<void>
  enviarACocina: (ordenId: number) => Promise<DetalleOrden[]>
  marcarPorCobrar: (ordenId: number) => Promise<void>
  cobrarOrden: (
    ordenId: number,
    metodo: MetodoPago,
    montoRecibido: number,
    descuento?: number
  ) => Promise<void>
  cancelarOrden: (ordenId: number) => Promise<void>
  registrarReimpresion: (
    tipo: Reimpresion['tipo'],
    ordenId: number,
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

  // Corte
  cerrarCorte: () => Promise<Corte>
}

const DatosContext = createContext<DatosContextValue | null>(null)

export function ProveedorDatos({ children }: { children: ReactNode }): React.JSX.Element {
  const [cargando, setCargando] = useState(true)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [ordenes, setOrdenes] = useState<OrdenConDetalle[]>([])
  const [cortes, setCortes] = useState<Corte[]>([])
  const [reimpresiones, setReimpresiones] = useState<Reimpresion[]>([])
  const [resumen, setResumen] = useState<ResumenTurno>(RESUMEN_VACIO)

  // --- Refrescos puntuales -------------------------------------------------
  const refrescarMesas = useCallback(async () => setMesas(await api.mesas.listar()), [])
  const refrescarOrdenes = useCallback(async () => setOrdenes(await api.ordenes.activas()), [])
  const refrescarCortes = useCallback(async () => setCortes(await api.cortes.listar()), [])
  const refrescarResumen = useCallback(async () => setResumen(await api.cortes.resumen()), [])
  const refrescarReimpresiones = useCallback(
    async () => setReimpresiones(await api.reimpresiones.listar()),
    []
  )
  const refrescarCatalogo = useCallback(async () => {
    const [cats, prods] = await Promise.all([api.catalogo.categorias(), api.catalogo.productos()])
    setCategorias(cats)
    setProductos(prods)
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
      const [m, cats, prods, ords, crts, reimp, res] = await Promise.all([
        api.mesas.listar(),
        api.catalogo.categorias(),
        api.catalogo.productos(),
        api.ordenes.activas(),
        api.cortes.listar(),
        api.reimpresiones.listar(),
        api.cortes.resumen()
      ])
      if (!activo) return
      setMesas(m)
      setCategorias(cats)
      setProductos(prods)
      setOrdenes(ords)
      setCortes(crts)
      setReimpresiones(reimp)
      setResumen(res)
      setCargando(false)
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
    async (ordenId: number, producto: Producto, modificadorIds?: number[]) => {
      aplicarOrden(await api.ordenes.agregarProducto(ordenId, producto.id, modificadorIds))
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
    async (ordenId: number): Promise<DetalleOrden[]> => {
      const nuevas = await api.ordenes.enviarCocina(ordenId)
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
    async (ordenId: number, metodo: MetodoPago, montoRecibido: number, descuento?: number) => {
      await api.ordenes.cobrar(ordenId, metodo, montoRecibido, descuento)
      await Promise.all([refrescarOrdenes(), refrescarMesas(), refrescarResumen()])
    },
    [refrescarOrdenes, refrescarMesas, refrescarResumen]
  )

  const cancelarOrden = useCallback(
    async (ordenId: number) => {
      await api.ordenes.cancelar(ordenId)
      await Promise.all([refrescarOrdenes(), refrescarMesas()])
    },
    [refrescarOrdenes, refrescarMesas]
  )

  const registrarReimpresion = useCallback(
    async (tipo: Reimpresion['tipo'], ordenId: number, usuario?: string) => {
      await api.reimpresiones.registrar(tipo, ordenId, usuario)
      await refrescarReimpresiones()
    },
    [refrescarReimpresiones]
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

  // --- Corte ---------------------------------------------------------------
  const cerrarCorte = useCallback(async (): Promise<Corte> => {
    const corte = await api.cortes.cerrar()
    await Promise.all([refrescarCortes(), refrescarResumen()])
    return corte
  }, [refrescarCortes, refrescarResumen])

  const valor = useMemo<DatosContextValue>(
    () => ({
      cargando,
      mesas,
      categorias,
      productos,
      ordenes,
      cortes,
      reimpresiones,
      resumen,
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
      registrarReimpresion,
      guardarProducto,
      eliminarProducto,
      guardarCategoria,
      eliminarCategoria,
      guardarGrupo,
      eliminarGrupo,
      guardarModificador,
      eliminarModificador,
      cerrarCorte
    }),
    [
      cargando,
      mesas,
      categorias,
      productos,
      ordenes,
      cortes,
      reimpresiones,
      resumen,
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
      registrarReimpresion,
      guardarProducto,
      eliminarProducto,
      guardarCategoria,
      eliminarCategoria,
      guardarGrupo,
      eliminarGrupo,
      guardarModificador,
      eliminarModificador,
      cerrarCorte
    ]
  )

  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

export function useDatos(): DatosContextValue {
  const ctx = useContext(DatosContext)
  if (!ctx) throw new Error('useDatos debe usarse dentro de <ProveedorDatos>')
  return ctx
}
