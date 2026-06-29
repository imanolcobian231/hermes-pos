import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  ConfigImpresoras,
  DestinoImpresion,
  DetalleOrden,
  DispositivoBluetooth,
  Impresora
} from '@shared/types'

// Impresión térmica de varias impresoras. La conexión y el envío de bytes viven
// en el renderer (Chromium para BLE; el main para COM). El proceso main solo
// arma los bytes ESC/POS. Cada impresora se identifica por su id local.

const SERVICIOS_CONOCIDOS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff10-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
]

const PREFIJOS_NOMBRE = [
  'POS', 'PT-', 'PTP', 'MTP', 'MPT', 'RPP', 'GP-', 'XP-', 'ZJ', 'EC-', 'SP-',
  'Printer', 'PRINTER', 'Thermal', 'BlueTooth', 'Bluetooth Printer', 'Goojprt', 'InnerPrinter'
]

const FILTROS = [
  ...SERVICIOS_CONOCIDOS.map((services) => ({ services: [services] })),
  ...PREFIJOS_NOMBRE.map((namePrefix) => ({ namePrefix }))
]

interface EstadoImpresora {
  conectado: boolean
  /** Etiqueta de la conexión (nombre del dispositivo BLE o puerto COM). */
  nombre: string | null
}

interface SelectorState {
  visible: boolean
  dispositivos: DispositivoBluetooth[]
}

interface Aviso {
  texto: string
  tipo: 'error' | 'info'
}

interface ImpresionContextValue {
  cfg: ConfigImpresoras | null
  impresoras: Impresora[]
  estados: Record<string, EstadoImpresora>
  selector: SelectorState
  /** Id de la impresora que se está conectando ahora (null = ninguna). */
  conectando: string | null
  aviso: Aviso | null
  limpiarAviso: () => void
  actualizarCfg: (parcial: Partial<ConfigImpresoras>) => Promise<void>
  // Gestión de impresoras
  agregarImpresora: (nombre: string) => Promise<void>
  renombrarImpresora: (id: string, nombre: string) => Promise<void>
  eliminarImpresora: (id: string) => Promise<void>
  marcarRol: (id: string, rol: 'caja' | 'cocina' | 'barra') => Promise<void>
  // Conexión
  conectar: (id: string) => Promise<void>
  configurarCom: (id: string, puerto: string, baudRate: number) => Promise<void>
  desconectar: (id: string) => void
  listarPuertos: () => Promise<string[]>
  mostrarTodos: () => void
  elegirDispositivo: (deviceId: string) => void
  cancelarSelector: () => void
  // Impresión
  imprimirComanda: (
    impresoraId: string,
    titulo: string,
    lineas: DetalleOrden[],
    opciones?: { adicional?: boolean; reimpresion?: boolean }
  ) => Promise<void>
  imprimirFinal: (ordenId: number, opciones?: { copia?: boolean }) => Promise<void>
  imprimirPrueba: (impresoraId: string) => Promise<void>
}

const ImpresionContext = createContext<ImpresionContextValue | null>(null)

// --- Utilidades BLE ----------------------------------------------------------

async function encontrarEscritura(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  const servicios = await server.getPrimaryServices()
  for (const s of servicios) {
    const chars = await s.getCharacteristics()
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c
    }
  }
  throw new Error('La impresora no expone una característica de escritura compatible')
}

const espera = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function conTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))])
}

async function conectarYBuscar(
  device: BluetoothDevice
): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!device.gatt) throw new Error('El dispositivo no es compatible (sin GATT)')
  let ultimoError: unknown
  for (let intento = 0; intento < 3; intento++) {
    try {
      const server = device.gatt.connected
        ? device.gatt
        : await conTimeout(device.gatt.connect(), 8000, 'La impresora no respondió al conectar')
      await espera(intento === 0 ? 350 : 600)
      if (!device.gatt.connected) throw new Error('GATT desconectado tras conectar')
      return await conTimeout(encontrarEscritura(server), 8000, 'No se pudieron leer los servicios de la impresora')
    } catch (e) {
      ultimoError = e
      try {
        device.gatt.disconnect()
      } catch {
        /* ignora */
      }
      await espera(500)
    }
  }
  const msg = ultimoError instanceof Error ? ultimoError.message : String(ultimoError)
  throw new Error(
    `No se pudo conectar (${msg}). Empareja la impresora en Windows (Bluetooth) y verifica que esté encendida y sin conectar a otro dispositivo.`
  )
}

async function escribirBytes(
  car: BluetoothRemoteGATTCharacteristic,
  datos: number[]
): Promise<void> {
  const bytes = Uint8Array.from(datos)
  const TAM = 180
  const sinRespuesta = car.properties.writeWithoutResponse
  for (let i = 0; i < bytes.length; i += TAM) {
    const trozo = bytes.subarray(i, i + TAM)
    if (sinRespuesta) await car.writeValueWithoutResponse(trozo)
    else await car.writeValue(trozo)
    await espera(20)
  }
  await espera(1200)
}

async function usarImpresora<T>(
  device: BluetoothDevice,
  fn: (car: BluetoothRemoteGATTCharacteristic) => Promise<T>
): Promise<T> {
  const caracteristica = await conectarYBuscar(device)
  try {
    return await fn(caracteristica)
  } finally {
    try {
      device.gatt?.disconnect()
    } catch {
      /* ignora */
    }
  }
}

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// --- Provider ----------------------------------------------------------------

export function ProveedorImpresion({ children }: { children: ReactNode }): React.JSX.Element {
  const [cfg, setCfg] = useState<ConfigImpresoras | null>(null)
  const [estados, setEstados] = useState<Record<string, EstadoImpresora>>({})
  const [selector, setSelector] = useState<SelectorState>({ visible: false, dispositivos: [] })
  const [conectando, setConectando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  // Referencias a los dispositivos BLE recordados, por id de impresora. NO se
  // mantienen conectados: se conecta solo al imprimir y se suelta enseguida.
  const dispositivos = useRef<Record<string, BluetoothDevice>>({})
  const cfgRef = useRef<ConfigImpresoras | null>(null)
  cfgRef.current = cfg
  const enCurso = useRef<string | null>(null)
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  const setEstado = (id: string, e: EstadoImpresora): void =>
    setEstados((prev) => ({ ...prev, [id]: e }))

  const limpiarAviso = (): void => setAviso(null)

  function enColaBLE<T>(tarea: () => Promise<T>): Promise<T> {
    const siguiente = cola.current.then(tarea, tarea)
    cola.current = siguiente.then(() => undefined, () => undefined)
    return siguiente
  }

  useEffect(() => {
    const quitar = window.api.ble.alDetectarDispositivos((lista) =>
      setSelector({ visible: true, dispositivos: lista })
    )
    void (async () => {
      const inicial = await window.api.config.obtenerImpresoras()
      setCfg(inicial)
      await precargar(inicial)
    })()
    return quitar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function precargar(config: ConfigImpresoras): Promise<void> {
    let conocidos: BluetoothDevice[] = []
    if (navigator.bluetooth?.getDevices) {
      try {
        conocidos = await navigator.bluetooth.getDevices()
      } catch {
        /* sin Bluetooth */
      }
    }
    const nuevos: Record<string, EstadoImpresora> = {}
    for (const imp of config.impresoras) {
      if (imp.tipo === 'com') {
        nuevos[imp.id] = { conectado: !!imp.puerto, nombre: imp.puerto ?? null }
      } else if (imp.tipo === 'bluetooth') {
        const device = conocidos.find((d) => d.id === imp.dispositivoId)
        if (device) {
          dispositivos.current[imp.id] = device
          nuevos[imp.id] = { conectado: true, nombre: device.name ?? 'Bluetooth' }
        } else {
          nuevos[imp.id] = { conectado: false, nombre: imp.dispositivoId ? 'Guardada' : null }
        }
      } else {
        nuevos[imp.id] = { conectado: false, nombre: null }
      }
    }
    setEstados(nuevos)
  }

  const actualizarCfg = async (parcial: Partial<ConfigImpresoras>): Promise<void> => {
    const base = cfgRef.current
    if (!base) return
    const nuevo = { ...base, ...parcial }
    setCfg(nuevo)
    await window.api.config.guardarImpresoras(nuevo)
  }

  const actualizarImpresora = async (id: string, parcial: Partial<Impresora>): Promise<void> => {
    const base = cfgRef.current
    if (!base) return
    await actualizarCfg({
      impresoras: base.impresoras.map((i) => (i.id === id ? { ...i, ...parcial } : i))
    })
  }

  // --- Gestión de impresoras -------------------------------------------------

  const agregarImpresora = async (nombre: string): Promise<void> => {
    const base = cfgRef.current
    if (!base) return
    const imp: Impresora = { id: nuevoId(), nombre: nombre.trim() || 'Impresora' }
    const esPrimera = base.impresoras.length === 0
    await actualizarCfg({
      impresoras: [...base.impresoras, imp],
      // La primera impresora se marca como Caja por defecto.
      impresoraCajaId: esPrimera ? imp.id : base.impresoraCajaId
    })
  }

  const renombrarImpresora = (id: string, nombre: string): Promise<void> =>
    actualizarImpresora(id, { nombre: nombre.trim() || 'Impresora' })

  const eliminarImpresora = async (id: string): Promise<void> => {
    const base = cfgRef.current
    if (!base) return
    delete dispositivos.current[id]
    setEstados((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
    await actualizarCfg({
      impresoras: base.impresoras.filter((i) => i.id !== id),
      impresoraCajaId: base.impresoraCajaId === id ? null : base.impresoraCajaId,
      impresoraCocinaId: base.impresoraCocinaId === id ? null : base.impresoraCocinaId,
      impresoraBarraId: base.impresoraBarraId === id ? null : base.impresoraBarraId
    })
  }

  const marcarRol = (id: string, rol: 'caja' | 'cocina' | 'barra'): Promise<void> =>
    actualizarCfg(
      rol === 'caja'
        ? { impresoraCajaId: id }
        : rol === 'cocina'
          ? { impresoraCocinaId: id }
          : { impresoraBarraId: id }
    )

  // --- Conexión --------------------------------------------------------------

  const conectar = async (id: string, todos = false): Promise<void> => {
    if (!navigator.bluetooth) {
      setAviso({ texto: 'Este equipo no tiene soporte de Bluetooth', tipo: 'error' })
      return
    }
    enCurso.current = id
    setConectando(id)
    try {
      const device = await navigator.bluetooth.requestDevice(
        todos
          ? { acceptAllDevices: true, optionalServices: SERVICIOS_CONOCIDOS }
          : { filters: FILTROS, optionalServices: SERVICIOS_CONOCIDOS }
      )
      await enColaBLE(() => usarImpresora(device, async () => undefined))
      dispositivos.current[id] = device
      setEstado(id, { conectado: true, nombre: device.name ?? 'Bluetooth' })
      await actualizarImpresora(id, {
        tipo: 'bluetooth',
        dispositivoId: device.id,
        puerto: undefined,
        baudRate: undefined
      })
      setAviso({ texto: 'Impresora lista', tipo: 'info' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/cancel/i.test(msg)) setAviso({ texto: msg, tipo: 'error' })
    } finally {
      setConectando(null)
    }
  }

  const configurarCom = async (id: string, puerto: string, baudRate: number): Promise<void> => {
    delete dispositivos.current[id]
    setEstado(id, { conectado: !!puerto, nombre: puerto || null })
    await actualizarImpresora(id, { tipo: 'com', puerto, baudRate, dispositivoId: undefined })
  }

  const listarPuertos = (): Promise<string[]> => window.api.printer.listarPuertos()

  const mostrarTodos = (): void => {
    const id = enCurso.current
    window.api.ble.seleccionar('')
    setSelector({ visible: false, dispositivos: [] })
    if (id) void espera(250).then(() => conectar(id, true))
  }

  const desconectar = (id: string): void => {
    const device = dispositivos.current[id]
    try {
      device?.gatt?.disconnect()
    } catch {
      /* ignora */
    }
    delete dispositivos.current[id]
    setEstado(id, { conectado: false, nombre: null })
    void actualizarImpresora(id, {
      tipo: undefined,
      dispositivoId: undefined,
      puerto: undefined,
      baudRate: undefined
    })
  }

  const elegirDispositivo = (deviceId: string): void => {
    window.api.ble.seleccionar(deviceId)
    setSelector({ visible: false, dispositivos: [] })
  }

  const cancelarSelector = (): void => {
    window.api.ble.seleccionar('')
    setSelector({ visible: false, dispositivos: [] })
  }

  // --- Envío e impresión -----------------------------------------------------

  async function resolverDevice(imp: Impresora): Promise<BluetoothDevice> {
    const enMem = dispositivos.current[imp.id]
    if (enMem) return enMem
    if (!imp.dispositivoId) throw new Error(`${imp.nombre}: reconéctala en Ajustes`)
    if (!navigator.bluetooth?.getDevices) throw new Error('Reconecta la impresora en Ajustes')
    const conocidos = await navigator.bluetooth.getDevices()
    const device = conocidos.find((d) => d.id === imp.dispositivoId)
    if (!device) throw new Error(`${imp.nombre} no está disponible; reconéctala en Ajustes`)
    dispositivos.current[imp.id] = device
    return device
  }

  const enviarA = async (imp: Impresora, bytes: number[]): Promise<void> => {
    if (imp.tipo === 'com') {
      if (!imp.puerto) throw new Error(`${imp.nombre}: falta el puerto COM`)
      await window.api.printer.enviarCom(imp.puerto, imp.baudRate ?? 9600, bytes)
      return
    }
    if (imp.tipo === 'bluetooth') {
      await enColaBLE(async () => {
        const device = await resolverDevice(imp)
        await usarImpresora(device, (car) => escribirBytes(car, bytes))
      })
      return
    }
    throw new Error(`${imp.nombre}: impresora sin configurar`)
  }

  const buscarImpresora = (id: string): Impresora | undefined =>
    cfgRef.current?.impresoras.find((i) => i.id === id)

  const imprimirComanda: ImpresionContextValue['imprimirComanda'] = async (
    impresoraId,
    titulo,
    lineas,
    opciones
  ) => {
    const imp = buscarImpresora(impresoraId)
    if (!imp) throw new Error('La impresora de esta categoría ya no existe')
    const bytes = await window.api.printer.bytesCocina(titulo, lineas, opciones)
    await enviarA(imp, bytes)
  }

  const imprimirFinal: ImpresionContextValue['imprimirFinal'] = async (ordenId, opciones) => {
    const conf = cfgRef.current
    const caja = conf?.impresoras.find((i) => i.id === conf.impresoraCajaId)
    if (!caja) throw new Error('No hay impresora de Caja configurada (asígnala en Ajustes)')
    const bytes = await window.api.printer.bytesFinal(ordenId, opciones)
    await enviarA(caja, bytes)
  }

  const imprimirPrueba: ImpresionContextValue['imprimirPrueba'] = async (impresoraId) => {
    const imp = buscarImpresora(impresoraId)
    if (!imp) throw new Error('Impresora no encontrada')
    const destino: DestinoImpresion =
      cfgRef.current?.impresoraCajaId === impresoraId ? 'caja' : 'cocina'
    const bytes = await window.api.printer.bytesPrueba(destino)
    await enviarA(imp, bytes)
  }

  return (
    <ImpresionContext.Provider
      value={{
        cfg,
        impresoras: cfg?.impresoras ?? [],
        estados,
        selector,
        conectando,
        aviso,
        limpiarAviso,
        actualizarCfg,
        agregarImpresora,
        renombrarImpresora,
        eliminarImpresora,
        marcarRol,
        conectar,
        configurarCom,
        desconectar,
        listarPuertos,
        mostrarTodos,
        elegirDispositivo,
        cancelarSelector,
        imprimirComanda,
        imprimirFinal,
        imprimirPrueba
      }}
    >
      {children}
    </ImpresionContext.Provider>
  )
}

export function useImpresion(): ImpresionContextValue {
  const ctx = useContext(ImpresionContext)
  if (!ctx) throw new Error('useImpresion debe usarse dentro de <ProveedorImpresion>')
  return ctx
}
