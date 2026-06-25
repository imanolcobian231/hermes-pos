import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  ConfigImpresoras,
  DestinoImpresion,
  DetalleOrden,
  DispositivoBluetooth
} from '@shared/types'

// Impresión térmica por Web Bluetooth (BLE). La conexión y el envío de bytes
// viven en el renderer (Chromium); el proceso main solo arma los bytes ESC/POS.

// Servicios BLE típicos de impresoras térmicas. Hay que declararlos para poder
// acceder a sus características tras conectar (requisito de Web Bluetooth).
const SERVICIOS_CONOCIDOS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000ff10-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
]

// Prefijos de nombre habituales de impresoras térmicas Bluetooth. Sirven para
// que aparezca la impresora aunque no anuncie su servicio en el escaneo.
const PREFIJOS_NOMBRE = [
  'POS',
  'PT-',
  'PTP',
  'MTP',
  'MPT',
  'RPP',
  'GP-',
  'XP-',
  'ZJ',
  'EC-',
  'SP-',
  'Printer',
  'PRINTER',
  'Thermal',
  'BlueTooth',
  'Bluetooth Printer',
  'Goojprt',
  'InnerPrinter'
]

// Solo se ofrecen dispositivos que anuncian un servicio conocido o cuyo nombre
// empieza con un prefijo típico de impresora. Así no aparece el ruido de
// celulares, audífonos, etc.
const FILTROS = [
  ...SERVICIOS_CONOCIDOS.map((services) => ({ services: [services] })),
  ...PREFIJOS_NOMBRE.map((namePrefix) => ({ namePrefix }))
]

interface EstadoImpresora {
  conectado: boolean
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
  estados: Record<DestinoImpresion, EstadoImpresora>
  selector: SelectorState
  /** Destino que se está conectando ahora mismo (null = ninguno). */
  conectando: DestinoImpresion | null
  /** Aviso para mostrar como toast (la página lo consume y lo limpia). */
  aviso: Aviso | null
  limpiarAviso: () => void
  actualizarCfg: (parcial: Partial<ConfigImpresoras>) => Promise<void>
  /** Conecta una impresora Bluetooth LE (abre el selector). */
  conectar: (destino: DestinoImpresion) => Promise<void>
  /** Configura una impresora por COM (Bluetooth Clásico / serial). */
  configurarCom: (destino: DestinoImpresion, puerto: string, baudRate: number) => Promise<void>
  /** Lista los puertos COM disponibles en Windows. */
  listarPuertos: () => Promise<string[]>
  /** Reintenta la conexión en curso mostrando TODOS los dispositivos (sin filtro). */
  mostrarTodos: () => void
  desconectar: (destino: DestinoImpresion) => void
  elegirDispositivo: (id: string) => void
  cancelarSelector: () => void
  imprimirCocina: (
    titulo: string,
    lineas: DetalleOrden[],
    opciones?: { adicional?: boolean; reimpresion?: boolean }
  ) => Promise<void>
  imprimirFinal: (ordenId: number, opciones?: { copia?: boolean }) => Promise<void>
  imprimirPrueba: (destino: DestinoImpresion) => Promise<void>
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

/** Aborta una promesa que tarda demasiado (evita que `connect()` se cuelgue). */
function conTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))
  ])
}

/**
 * Conecta el GATT y localiza la característica de escritura, con reintentos y
 * TIEMPO LÍMITE. Las impresoras BLE económicas a veces dejan `connect()`
 * colgado para siempre; el timeout hace que falle con un mensaje claro.
 */
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
      // Deja que la conexión se estabilice antes de descubrir servicios.
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
  const TAM = 180 // BLE entrega en paquetes pequeños; troceamos.
  const sinRespuesta = car.properties.writeWithoutResponse
  for (let i = 0; i < bytes.length; i += TAM) {
    const trozo = bytes.subarray(i, i + TAM)
    if (sinRespuesta) await car.writeValueWithoutResponse(trozo)
    else await car.writeValue(trozo)
    await espera(20)
  }
  // Deja que la impresora procese los últimos bytes (avance de papel y corte)
  // ANTES de soltar la conexión. Con writeWithoutResponse no hay confirmación,
  // así que sin esta espera se perdería el avance/corte final.
  await espera(1200)
}

/**
 * Conecta, ejecuta `fn` con la característica de escritura y SIEMPRE desconecta
 * al terminar. Mantener una sola conexión a la vez evita que un adaptador BLE
 * (que no soporta conexiones simultáneas) se cuelgue al conectar la segunda.
 */
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

// --- Provider ----------------------------------------------------------------

export function ProveedorImpresion({ children }: { children: ReactNode }): React.JSX.Element {
  const [cfg, setCfg] = useState<ConfigImpresoras | null>(null)
  const [estados, setEstados] = useState<Record<DestinoImpresion, EstadoImpresora>>({
    caja: { conectado: false, nombre: null },
    cocina: { conectado: false, nombre: null }
  })
  const [selector, setSelector] = useState<SelectorState>({ visible: false, dispositivos: [] })
  const [conectando, setConectando] = useState<DestinoImpresion | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  // Dispositivos recordados. NO se mantienen conectados: se conecta solo en el
  // momento de imprimir y se suelta enseguida.
  const dispositivos = useRef<Partial<Record<DestinoImpresion, BluetoothDevice>>>({})
  const cfgRef = useRef<ConfigImpresoras | null>(null)
  cfgRef.current = cfg
  // Destino cuya conexión está en curso (para el botón "mostrar todos").
  const destinoEnCurso = useRef<DestinoImpresion | null>(null)
  // Cola para serializar las operaciones BLE (nunca dos al mismo tiempo).
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  const setEstado = (destino: DestinoImpresion, e: EstadoImpresora): void =>
    setEstados((prev) => ({ ...prev, [destino]: e }))

  const limpiarAviso = (): void => setAviso(null)

  function enColaBLE<T>(tarea: () => Promise<T>): Promise<T> {
    const siguiente = cola.current.then(tarea, tarea)
    // La cadena nunca se rompe aunque una tarea falle.
    cola.current = siguiente.then(
      () => undefined,
      () => undefined
    )
    return siguiente
  }

  async function resolverDevice(destino: DestinoImpresion): Promise<BluetoothDevice> {
    const enMemoria = dispositivos.current[destino]
    if (enMemoria) return enMemoria
    const guardado = cfgRef.current?.[destino]
    if (!guardado) throw new Error('Impresora no configurada')
    if (!navigator.bluetooth?.getDevices) throw new Error('Reconecta la impresora en Ajustes')
    const conocidos = await navigator.bluetooth.getDevices()
    const device = conocidos.find((d) => d.id === guardado.id)
    if (!device) throw new Error('La impresora guardada no está disponible; reconéctala en Ajustes')
    dispositivos.current[destino] = device
    return device
  }

  // Carga la config y precarga las referencias a las impresoras recordadas.
  useEffect(() => {
    const quitar = window.api.ble.alDetectarDispositivos((lista) =>
      setSelector({ visible: true, dispositivos: lista })
    )
    void (async () => {
      const inicial = await window.api.config.obtenerImpresoras()
      setCfg(inicial)
      setEstados({
        caja: { conectado: false, nombre: inicial.caja?.nombre ?? null },
        cocina: { conectado: false, nombre: inicial.cocina?.nombre ?? null }
      })
      await precargarDispositivos(inicial)
    })()
    return quitar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function precargarDispositivos(config: ConfigImpresoras): Promise<void> {
    let conocidos: BluetoothDevice[] = []
    if (navigator.bluetooth?.getDevices) {
      try {
        conocidos = await navigator.bluetooth.getDevices()
      } catch {
        /* sin Bluetooth disponible */
      }
    }
    for (const destino of ['caja', 'cocina'] as DestinoImpresion[]) {
      const guardado = config[destino]
      if (!guardado) continue
      // COM: lista si tiene puerto (no hay conexión persistente).
      if (guardado.tipo === 'com') {
        setEstado(destino, { conectado: !!guardado.puerto, nombre: guardado.puerto ?? guardado.nombre })
        continue
      }
      // Bluetooth: carga la referencia del dispositivo recordado.
      const device = conocidos.find((d) => d.id === guardado.id)
      if (!device) continue
      dispositivos.current[destino] = device
      setEstado(destino, { conectado: true, nombre: device.name ?? guardado.nombre })
    }
  }

  const actualizarCfg = async (parcial: Partial<ConfigImpresoras>): Promise<void> => {
    const base = cfgRef.current
    if (!base) return
    const nuevo = { ...base, ...parcial }
    setCfg(nuevo)
    await window.api.config.guardarImpresoras(nuevo)
  }

  const conectar = async (destino: DestinoImpresion, todos = false): Promise<void> => {
    if (!navigator.bluetooth) {
      setAviso({ texto: 'Este equipo no tiene soporte de Bluetooth', tipo: 'error' })
      return
    }
    destinoEnCurso.current = destino
    setConectando(destino)
    try {
      const device = await navigator.bluetooth.requestDevice(
        todos
          ? { acceptAllDevices: true, optionalServices: SERVICIOS_CONOCIDOS }
          : { filters: FILTROS, optionalServices: SERVICIOS_CONOCIDOS }
      )
      // Verifica que conecta y suelta enseguida (no se mantiene abierta).
      await enColaBLE(() => usarImpresora(device, async () => undefined))
      dispositivos.current[destino] = device
      setEstado(destino, { conectado: true, nombre: device.name ?? 'Impresora' })
      await actualizarCfg({
        [destino]: { tipo: 'bluetooth', id: device.id, nombre: device.name ?? 'Impresora' }
      })
      setAviso({ texto: 'Impresora lista', tipo: 'info' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/cancel/i.test(msg)) setAviso({ texto: msg, tipo: 'error' })
    } finally {
      setConectando(null)
    }
  }

  // Configura una impresora por COM (Bluetooth Clásico / serial). No mantiene
  // conexión: imprime por el puerto en el momento (lo hace el proceso main).
  const configurarCom = async (
    destino: DestinoImpresion,
    puerto: string,
    baudRate: number
  ): Promise<void> => {
    delete dispositivos.current[destino] // por si antes era Bluetooth
    setEstado(destino, { conectado: !!puerto, nombre: puerto || null })
    await actualizarCfg({ [destino]: { tipo: 'com', nombre: puerto, puerto, baudRate } })
  }

  const listarPuertos = (): Promise<string[]> => window.api.printer.listarPuertos()

  // Reintenta la conexión en curso pero mostrando TODOS los dispositivos.
  const mostrarTodos = (): void => {
    const destino = destinoEnCurso.current
    window.api.ble.seleccionar('') // cancela el requestDevice filtrado en curso
    setSelector({ visible: false, dispositivos: [] })
    if (destino) void espera(250).then(() => conectar(destino, true))
  }

  const desconectar = (destino: DestinoImpresion): void => {
    const device = dispositivos.current[destino]
    try {
      device?.gatt?.disconnect()
    } catch {
      /* ignora */
    }
    delete dispositivos.current[destino]
    setEstado(destino, { conectado: false, nombre: null })
    void actualizarCfg({ [destino]: null })
  }

  const elegirDispositivo = (id: string): void => {
    window.api.ble.seleccionar(id)
    setSelector({ visible: false, dispositivos: [] })
  }

  const cancelarSelector = (): void => {
    window.api.ble.seleccionar('')
    setSelector({ visible: false, dispositivos: [] })
  }

  const enviar = async (destino: DestinoImpresion, bytes: number[]): Promise<void> => {
    // Resuelve qué impresora usar según el modo (una/dos).
    const config = cfgRef.current
    const efectivo: DestinoImpresion =
      destino === 'cocina' && config?.modo === 'dos' ? 'cocina' : 'caja'
    const impresora = config?.[efectivo]
    if (!impresora && !dispositivos.current[efectivo]) {
      throw new Error(
        efectivo === 'cocina'
          ? 'La impresora de cocina no está configurada'
          : 'La impresora no está configurada'
      )
    }
    // COM (Bluetooth Clásico/serial): lo envía el proceso main por el puerto.
    if (impresora?.tipo === 'com') {
      if (!impresora.puerto) throw new Error('Falta el puerto COM de la impresora')
      await window.api.printer.enviarCom(impresora.puerto, impresora.baudRate ?? 9600, bytes)
      return
    }
    // Bluetooth LE: conecta solo para imprimir y suelta (serializado en la cola).
    await enColaBLE(async () => {
      const device = await resolverDevice(efectivo)
      await usarImpresora(device, (car) => escribirBytes(car, bytes))
    })
  }

  const imprimirCocina: ImpresionContextValue['imprimirCocina'] = async (titulo, lineas, opciones) => {
    const bytes = await window.api.printer.bytesCocina(titulo, lineas, opciones)
    await enviar('cocina', bytes)
  }

  const imprimirFinal: ImpresionContextValue['imprimirFinal'] = async (ordenId, opciones) => {
    const bytes = await window.api.printer.bytesFinal(ordenId, opciones)
    await enviar('caja', bytes)
  }

  const imprimirPrueba: ImpresionContextValue['imprimirPrueba'] = async (destino) => {
    const bytes = await window.api.printer.bytesPrueba(destino)
    await enviar(destino, bytes)
  }

  return (
    <ImpresionContext.Provider
      value={{
        cfg,
        estados,
        selector,
        conectando,
        aviso,
        limpiarAviso,
        actualizarCfg,
        conectar,
        configurarCom,
        listarPuertos,
        mostrarTodos,
        desconectar,
        elegirDispositivo,
        cancelarSelector,
        imprimirCocina,
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
