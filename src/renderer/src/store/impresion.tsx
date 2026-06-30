import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  ConfigImpresoras,
  Corte,
  DestinoImpresion,
  DetalleOrden,
  DispositivoBluetooth,
  Impresora,
  LogoTicket
} from '@shared/types'
import { logoHermes } from '@renderer/lib/logo'

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
  cambiarAnchoImpresora: (id: string, ancho: number) => Promise<void>
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
    opciones?: {
      adicional?: boolean
      reimpresion?: boolean
      cancelacion?: boolean
      area?: 'cocina' | 'barra'
    }
  ) => Promise<void>
  /** Varias comandas: las del MISMO destino se concatenan y se envían en una sola
   *  sesión Bluetooth (sin reconectar entre tickets → sin demora entre ellos). */
  imprimirComandas: (
    comandas: {
      impresoraId: string
      titulo: string
      lineas: DetalleOrden[]
      opciones?: {
        adicional?: boolean
        reimpresion?: boolean
        cancelacion?: boolean
        area?: 'cocina' | 'barra'
      }
    }[]
  ) => Promise<void>
  imprimirFinal: (ordenId: number, opciones?: { copia?: boolean }) => Promise<void>
  imprimirCorte: (corte: Corte) => Promise<void>
  imprimirPrueba: (impresoraId: string) => Promise<void>
}

const ImpresionContext = createContext<ImpresionContextValue | null>(null)

// --- Utilidades BLE ----------------------------------------------------------

async function encontrarEscritura(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  const servicios = await server.getPrimaryServices()
  let conRespuesta: BluetoothRemoteGATTCharacteristic | null = null
  let sinRespuesta: BluetoothRemoteGATTCharacteristic | null = null
  for (const s of servicios) {
    const chars = await s.getCharacteristics()
    for (const c of chars) {
      if (c.properties.write && !conRespuesta) conRespuesta = c
      else if (c.properties.writeWithoutResponse && !sinRespuesta) sinRespuesta = c
    }
  }
  // Prefiere la que soporta escritura CON respuesta (más confiable con payloads grandes).
  const car = conRespuesta ?? sinRespuesta
  if (car) return car
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
  // Bloques chicos: más compatible con impresoras BLE económicas y payloads
  // grandes (con logo). Cada bloque reintenta un par de veces ante un fallo
  // transitorio de GATT antes de propagar el error.
  const TAM = 128
  // Preferir escritura CON respuesta (writeValue): espera el ACK de cada bloque,
  // así hay control de flujo y no se desborda el buffer de la impresora (causa
  // típica de "GATT operation failed"). Solo si la característica no soporta
  // 'write' se usa la versión sin respuesta.
  const conRespuesta = car.properties.write
  for (let i = 0; i < bytes.length; i += TAM) {
    const trozo = bytes.subarray(i, i + TAM)
    let ultimoError: unknown
    for (let intento = 0; intento < 3; intento++) {
      try {
        if (conRespuesta) await car.writeValue(trozo)
        else await car.writeValueWithoutResponse(trozo)
        ultimoError = null
        break
      } catch (e) {
        ultimoError = e
        await espera(80)
      }
    }
    if (ultimoError) throw ultimoError
    await espera(conRespuesta ? 8 : 20)
  }
  // Margen para que la impresora termine de procesar antes de soltar la conexión.
  await espera(450)
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

  const cambiarAnchoImpresora = (id: string, ancho: number): Promise<void> =>
    actualizarImpresora(id, { ancho })

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
        // Reintenta todo el envío reconectando: si la conexión estaba "viva" pero
        // muerta (GATT operation failed), el 2º intento reconecta desde cero.
        let ultimoError: unknown
        for (let intento = 0; intento < 2; intento++) {
          try {
            await usarImpresora(device, (car) => escribirBytes(car, bytes))
            return
          } catch (e) {
            ultimoError = e
            try {
              device.gatt?.disconnect()
            } catch {
              /* ignora */
            }
            await espera(700)
          }
        }
        throw ultimoError
      })
      return
    }
    throw new Error(`${imp.nombre}: impresora sin configurar`)
  }

  const buscarImpresora = (id: string): Impresora | undefined =>
    cfgRef.current?.impresoras.find((i) => i.id === id)

  // Logo de Hermes (pie del ticket) rasterizado al ancho de la impresora. Si
  // falla la rasterización, devuelve undefined y el ticket usa el texto "Hermes".
  const pieHermes = async (imp: Impresora): Promise<LogoTicket | undefined> => {
    const dots = (imp.ancho ?? cfgRef.current?.ancho ?? 32) === 48 ? 576 : 384
    try {
      return await logoHermes(Math.round(dots / 2))
    } catch {
      return undefined
    }
  }

  const imprimirComanda: ImpresionContextValue['imprimirComanda'] = async (
    impresoraId,
    titulo,
    lineas,
    opciones
  ) => {
    const imp = buscarImpresora(impresoraId)
    if (!imp) throw new Error('La impresora de esta categoría ya no existe')
    const bytes = await window.api.printer.bytesCocina(titulo, lineas, opciones, imp.ancho)
    await enviarA(imp, bytes)
  }

  const imprimirComandas: ImpresionContextValue['imprimirComandas'] = async (comandas) => {
    // Construye los bytes de cada comanda y los concatena por impresora, para
    // enviar todo en UNA sola sesión (sin reconectar entre tickets).
    const porImpresora = new Map<string, number[]>()
    for (const c of comandas) {
      const imp = buscarImpresora(c.impresoraId)
      if (!imp) continue
      const bytes = await window.api.printer.bytesCocina(c.titulo, c.lineas, c.opciones, imp.ancho)
      const acc = porImpresora.get(c.impresoraId)
      if (acc) acc.push(...bytes)
      else porImpresora.set(c.impresoraId, [...bytes])
    }
    for (const [impId, bytes] of porImpresora) {
      const imp = buscarImpresora(impId)
      if (imp) await enviarA(imp, bytes)
    }
  }

  const imprimirFinal: ImpresionContextValue['imprimirFinal'] = async (ordenId, opciones) => {
    const conf = cfgRef.current
    const caja = conf?.impresoras.find((i) => i.id === conf.impresoraCajaId)
    if (!caja) throw new Error('No hay impresora de Caja configurada (asígnala en Ajustes)')
    const bytes = await window.api.printer.bytesFinal(ordenId, opciones, caja.ancho, await pieHermes(caja))
    await enviarA(caja, bytes)
  }

  const imprimirCorte: ImpresionContextValue['imprimirCorte'] = async (corte) => {
    const conf = cfgRef.current
    const caja = conf?.impresoras.find((i) => i.id === conf.impresoraCajaId)
    if (!caja) throw new Error('No hay impresora de Caja configurada (asígnala en Ajustes)')
    const bytes = await window.api.printer.bytesCorte(corte, caja.ancho)
    await enviarA(caja, bytes)
  }

  const imprimirPrueba: ImpresionContextValue['imprimirPrueba'] = async (impresoraId) => {
    const imp = buscarImpresora(impresoraId)
    if (!imp) throw new Error('Impresora no encontrada')
    const destino: DestinoImpresion =
      cfgRef.current?.impresoraCajaId === impresoraId ? 'caja' : 'cocina'
    const pie = destino === 'caja' ? await pieHermes(imp) : undefined
    const bytes = await window.api.printer.bytesPrueba(destino, imp.ancho, pie)
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
        cambiarAnchoImpresora,
        conectar,
        configurarCom,
        desconectar,
        listarPuertos,
        mostrarTodos,
        elegirDispositivo,
        cancelarSelector,
        imprimirComanda,
        imprimirComandas,
        imprimirFinal,
        imprimirCorte,
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
