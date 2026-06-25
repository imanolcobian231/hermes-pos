import { useEffect, useState } from 'react'
import type { ConfigRespaldo, DestinoImpresion, RespaldoInfo } from '@shared/types'
import { useImpresion } from '@renderer/store/impresion'
import { useToast } from '@renderer/components/Toast'
import { fechaHora } from '@renderer/lib/format'
import { Icono } from '@renderer/components/Icono'

const BAUDIOS = [9600, 19200, 38400, 57600, 115200]

export function Ajustes(): React.JSX.Element {
  const { cfg, aviso, limpiarAviso, actualizarCfg } = useImpresion()
  const toast = useToast()
  const [negocio, setNegocio] = useState({ nombreNegocio: '', direccion: '', telefono: '' })

  // Los avisos de conexión (éxito/error) vienen del store; se muestran como toast.
  useEffect(() => {
    if (!aviso) return
    toast(aviso.texto, aviso.tipo === 'error' ? 'error' : 'info')
    limpiarAviso()
  }, [aviso, toast, limpiarAviso])

  // Sincroniza los campos del negocio con la config al cargar.
  useEffect(() => {
    if (cfg) {
      setNegocio({
        nombreNegocio: cfg.nombreNegocio,
        direccion: cfg.direccion,
        telefono: cfg.telefono
      })
    }
  }, [cfg?.nombreNegocio, cfg?.direccion, cfg?.telefono])

  const guardarNegocio = (): void => {
    void actualizarCfg({
      nombreNegocio: negocio.nombreNegocio.trim(),
      direccion: negocio.direccion.trim(),
      telefono: negocio.telefono.trim()
    })
  }

  if (!cfg) {
    return <div className="flex h-full items-center justify-center text-slate-400">Cargando…</div>
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Ajustes</h1>
        <p className="text-sm text-slate-500">Impresoras térmicas (Bluetooth o puerto COM)</p>
      </header>

      <div className="flex flex-col gap-5 overflow-auto pb-4">
        {/* Negocio */}
        <Seccion titulo="Negocio">
          <div className="flex flex-col gap-3">
            <CampoNegocio
              label="Nombre del negocio"
              valor={negocio.nombreNegocio}
              placeholder="Ej. Taquería La Esquina"
              onChange={(v) => setNegocio((n) => ({ ...n, nombreNegocio: v }))}
              onGuardar={guardarNegocio}
            />
            <CampoNegocio
              label="Dirección"
              valor={negocio.direccion}
              placeholder="Ej. Av. Juárez 123, Centro"
              onChange={(v) => setNegocio((n) => ({ ...n, direccion: v }))}
              onGuardar={guardarNegocio}
            />
            <CampoNegocio
              label="Teléfono"
              valor={negocio.telefono}
              placeholder="Ej. 55 1234 5678"
              onChange={(v) => setNegocio((n) => ({ ...n, telefono: v }))}
              onGuardar={guardarNegocio}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Aparecen como encabezado en los tickets. Déjalos vacíos para no imprimirlos.
          </p>
        </Seccion>

        {/* Cantidad de impresoras */}
        <Seccion titulo="Impresoras">
          <p className="mb-3 text-sm text-slate-500">¿Cuántas impresoras usa el negocio?</p>
          <div className="grid grid-cols-2 gap-3">
            <OpcionModo
              activo={cfg.modo === 'una'}
              titulo="Una impresora"
              detalle="La misma imprime comandas de cocina y tickets de caja."
              onClick={() => void actualizarCfg({ modo: 'una' })}
            />
            <OpcionModo
              activo={cfg.modo === 'dos'}
              titulo="Dos impresoras"
              detalle="Una en cocina (comandas) y otra en caja (ticket del cliente)."
              onClick={() => void actualizarCfg({ modo: 'dos' })}
            />
          </div>
        </Seccion>

        {/* Impresora de caja (o única) */}
        <Seccion titulo={cfg.modo === 'dos' ? 'Impresora de caja' : 'Impresora'}>
          <Impresora destino="caja" />
        </Seccion>

        {/* Impresora de cocina (solo en modo dos) */}
        {cfg.modo === 'dos' && (
          <Seccion titulo="Impresora de cocina">
            <Impresora destino="cocina" />
          </Seccion>
        )}

        {/* Tamaño de papel */}
        <Seccion titulo="Tamaño de papel">
          <p className="mb-3 text-sm text-slate-500">Ancho del rollo de la impresora.</p>
          <div className="grid grid-cols-2 gap-3">
            <OpcionModo
              activo={cfg.ancho === 32}
              titulo="58 mm"
              detalle="Rollo angosto (32 caracteres por línea)."
              onClick={() => void actualizarCfg({ ancho: 32 })}
            />
            <OpcionModo
              activo={cfg.ancho === 48}
              titulo="80 mm"
              detalle="Rollo ancho (48 caracteres por línea)."
              onClick={() => void actualizarCfg({ ancho: 48 })}
            />
          </div>
        </Seccion>

        {/* Impuestos */}
        <Seccion titulo="Impuestos">
          <Switch
            activo={cfg.impuestoActivo}
            label="Aplicar IVA al ticket"
            onChange={(v) => void actualizarCfg({ impuestoActivo: v })}
          />
          {cfg.impuestoActivo && (
            <>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">Tasa de IVA (%)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cfg.impuestoTasa}
                  onChange={(e) =>
                    void actualizarCfg({ impuestoTasa: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-slate-500"
                />
              </div>
              <Switch
                activo={cfg.impuestoIncluido}
                label="El IVA ya está incluido en los precios"
                onChange={(v) => void actualizarCfg({ impuestoIncluido: v })}
              />
              <p className="text-xs text-slate-400">
                Activado: el ticket solo desglosa el IVA (el total no cambia). Desactivado: el IVA se
                suma al total y el cliente paga más.
              </p>
            </>
          )}
        </Seccion>

        {/* Opciones de ticket */}
        <Seccion titulo="Opciones del ticket">
          <Switch
            activo={cfg.cortarPapel}
            label="Cortar el papel automáticamente"
            onChange={(v) => void actualizarCfg({ cortarPapel: v })}
          />
          <Switch
            activo={cfg.abrirCajon}
            label="Abrir el cajón de dinero al cobrar"
            onChange={(v) => void actualizarCfg({ abrirCajon: v })}
          />
          <Switch
            activo={cfg.cocinaGrande}
            label="Letra grande en comandas de cocina"
            onChange={(v) => void actualizarCfg({ cocinaGrande: v })}
          />
          <Stepper
            label="Avance de papel al final"
            ayuda="Sube esto si el último renglón queda atorado dentro de la impresora."
            valor={cfg.avanceFinal}
            min={0}
            max={20}
            onChange={(n) => void actualizarCfg({ avanceFinal: n })}
          />
        </Seccion>

        {/* Respaldo de la base de datos */}
        <SeccionRespaldos />

        <p className="text-xs text-slate-400">
          La impresora debe estar encendida. <strong>Bluetooth:</strong> al pulsar “Conectar por
          Bluetooth” aparece la lista de dispositivos cercanos; elige la impresora y queda enlazada.{' '}
          <strong>Puerto COM:</strong> para impresoras Bluetooth Clásico o serial (ej. PT-210),
          primero empareja la impresora en Windows y luego elige aquí su puerto COM y los baudios. La
          app se conecta solo al momento de imprimir, por eso pueden convivir dos impresoras sin
          estorbarse.
        </p>
      </div>
    </div>
  )
}

function CampoNegocio({
  label,
  valor,
  placeholder,
  onChange,
  onGuardar
}: {
  label: string
  valor: string
  placeholder?: string
  onChange: (v: string) => void
  onGuardar: () => void
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onGuardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  )
}

// Configura una impresora (caja o cocina) por Bluetooth LE o por puerto COM.
// Maneja su propio estado: prueba en curso, vista COM y selección de puerto.
function Impresora({ destino }: { destino: DestinoImpresion }): React.JSX.Element {
  const { cfg, estados, conectando, conectar, desconectar, configurarCom, listarPuertos, imprimirPrueba } =
    useImpresion()
  const toast = useToast()
  const estado = estados[destino]
  const conf = cfg?.[destino] ?? null

  const [probando, setProbando] = useState(false)
  // Vista de configuración por puerto COM (Bluetooth Clásico / serial).
  const [modoCom, setModoCom] = useState(conf?.tipo === 'com')
  const [puertos, setPuertos] = useState<string[]>([])
  const [cargandoPuertos, setCargandoPuertos] = useState(false)
  const [puerto, setPuerto] = useState(conf?.puerto ?? '')
  const [baud, setBaud] = useState(conf?.baudRate ?? 9600)

  const refrescarPuertos = async (): Promise<void> => {
    setCargandoPuertos(true)
    try {
      const lista = await listarPuertos()
      setPuertos(lista)
      // Preselecciona el guardado si sigue disponible; si no, el primero.
      if (!lista.includes(puerto)) setPuerto(lista[0] ?? '')
    } catch {
      toast('No se pudieron leer los puertos COM', 'error')
    } finally {
      setCargandoPuertos(false)
    }
  }

  const abrirCom = (): void => {
    setModoCom(true)
    void refrescarPuertos()
  }

  const guardarCom = async (): Promise<void> => {
    if (!puerto) {
      toast('Elige un puerto COM (empareja antes la impresora en Windows)', 'error')
      return
    }
    await configurarCom(destino, puerto, baud)
    toast('Impresora por COM guardada', 'info')
  }

  const probar = async (): Promise<void> => {
    setProbando(true)
    try {
      await imprimirPrueba(destino)
      toast('Ticket de prueba enviado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir la prueba', 'error')
    } finally {
      setProbando(false)
    }
  }

  const conectandoBle = conectando === destino
  const detalleEstado = estado.conectado
    ? conf?.tipo === 'com'
      ? `Puerto ${conf.puerto} · lista para imprimir`
      : 'Bluetooth · lista para imprimir'
    : estado.nombre
      ? 'Guardada · no disponible'
      : 'Ninguna impresora'

  return (
    <div className="flex flex-col gap-3">
      {/* Estado actual de la impresora */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${estado.conectado ? 'bg-emerald-500' : 'bg-slate-300'}`}
          />
          <div className="leading-tight">
            <div className="font-semibold text-slate-800">{estado.nombre ?? 'Sin configurar'}</div>
            <div className="text-xs text-slate-400">{detalleEstado}</div>
          </div>
        </div>
        {estado.conectado && (
          <button
            onClick={() => desconectar(destino)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Quitar
          </button>
        )}
      </div>

      {/* Configuración del transporte (cuando no hay impresora lista) */}
      {!estado.conectado && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <TabTransporte activo={!modoCom} onClick={() => setModoCom(false)}>
              Bluetooth
            </TabTransporte>
            <TabTransporte activo={modoCom} onClick={abrirCom}>
              Puerto COM
            </TabTransporte>
          </div>

          {!modoCom ? (
            <button
              onClick={() => void conectar(destino)}
              disabled={conectandoBle}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {conectandoBle ? 'Buscando…' : 'Conectar por Bluetooth'}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Puerto</label>
                <div className="flex gap-2">
                  <select
                    value={puerto}
                    onChange={(e) => setPuerto(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                  >
                    {puertos.length === 0 && <option value="">Sin puertos detectados</option>}
                    {puertos.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void refrescarPuertos()}
                    disabled={cargandoPuertos}
                    title="Actualizar lista de puertos"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {cargandoPuertos ? '…' : '↻'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Baudios</label>
                <select
                  value={baud}
                  onChange={(e) => setBaud(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                >
                  {BAUDIOS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void guardarCom()}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Guardar impresora COM
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => void probar()}
        disabled={!estado.conectado || probando}
        className="flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
      >
        <Icono nombre="imprimir" size={15} />
        {probando ? 'Imprimiendo…' : 'Imprimir prueba'}
      </button>
    </div>
  )
}

// Pestaña para elegir el tipo de transporte (Bluetooth / COM).
function TabTransporte({
  activo,
  onClick,
  children
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
        activo
          ? 'border-slate-900 bg-slate-100 text-slate-900'
          : 'border-slate-200 text-slate-500 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function Seccion({
  titulo,
  children
}: {
  titulo: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{titulo}</h2>
      {children}
    </section>
  )
}

// Respaldo de la base de datos: activar el automático, elegir carpeta, respaldar
// manualmente y ver los respaldos existentes.
function SeccionRespaldos(): React.JSX.Element {
  const toast = useToast()
  const [cfg, setCfg] = useState<ConfigRespaldo | null>(null)
  const [lista, setLista] = useState<RespaldoInfo[]>([])
  const [ocupado, setOcupado] = useState(false)

  const cargar = async (): Promise<void> => {
    const [c, l] = await Promise.all([window.api.respaldo.obtener(), window.api.respaldo.listar()])
    setCfg(c)
    setLista(l)
  }

  useEffect(() => {
    void cargar()
  }, [])

  const guardar = async (parcial: Partial<ConfigRespaldo>): Promise<void> => {
    if (!cfg) return
    const nuevo = { ...cfg, ...parcial }
    setCfg(nuevo)
    await window.api.respaldo.guardar(nuevo)
  }

  const respaldarAhora = async (): Promise<void> => {
    setOcupado(true)
    try {
      await window.api.respaldo.ahora()
      toast('Respaldo creado', 'info')
      await cargar()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo respaldar', 'error')
    } finally {
      setOcupado(false)
    }
  }

  const cambiarCarpeta = async (): Promise<void> => {
    const carpeta = await window.api.respaldo.elegirCarpeta()
    if (carpeta) {
      await cargar()
      toast('Carpeta de respaldos actualizada', 'info')
    }
  }

  const botonClase =
    'rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50'

  if (!cfg) {
    return (
      <Seccion titulo="Respaldos">
        <p className="text-sm text-slate-400">Cargando…</p>
      </Seccion>
    )
  }

  return (
    <Seccion titulo="Respaldos">
      <Switch
        activo={cfg.automatico}
        label="Respaldo automático (diario y al cerrar turno)"
        onChange={(v) => void guardar({ automatico: v })}
      />
      <div className="mt-2 rounded-lg border border-slate-200 p-3">
        <div className="mb-1 text-xs font-medium text-slate-500">Carpeta de respaldos</div>
        <div className="mb-3 break-all text-sm text-slate-700">
          {cfg.carpeta ?? 'Carpeta predeterminada de la app'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void cambiarCarpeta()} className={botonClase}>
            Cambiar carpeta
          </button>
          <button onClick={() => void window.api.respaldo.abrirCarpeta()} className={botonClase}>
            Abrir carpeta
          </button>
          <button
            onClick={() => void respaldarAhora()}
            disabled={ocupado}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {ocupado ? 'Respaldando…' : 'Respaldar ahora'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {cfg.ultimo ? `Último respaldo: ${fechaHora(cfg.ultimo)}` : 'Aún no se ha hecho ningún respaldo.'}
      </p>
      {lista.length > 0 && (
        <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-slate-200">
          {lista.map((r) => (
            <div
              key={r.ruta}
              className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs last:border-0"
            >
              <span className="text-slate-600">{fechaHora(r.fecha)}</span>
              <span className="text-slate-400">{Math.max(1, Math.round(r.tamano / 1024))} KB</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Se conservan los últimos 14 respaldos. Guarda la carpeta en una USB o servicio en la nube
        para no perder la información si falla el equipo.
      </p>
    </Seccion>
  )
}

function OpcionModo({
  activo,
  titulo,
  detalle,
  onClick
}: {
  activo: boolean
  titulo: string
  detalle: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 p-3 text-left transition ${
        activo ? 'border-slate-900 bg-slate-100' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="font-semibold text-slate-800">{titulo}</div>
      <div className="mt-0.5 text-xs text-slate-500">{detalle}</div>
    </button>
  )
}

function Stepper({
  label,
  ayuda,
  valor,
  min,
  max,
  onChange
}: {
  label: string
  ayuda?: string
  valor: number
  min: number
  max: number
  onChange: (n: number) => void
}): React.JSX.Element {
  const ajustar = (delta: number): void => onChange(Math.max(min, Math.min(valor + delta, max)))
  return (
    <div className="flex items-center justify-between py-2">
      <div className="pr-3">
        <div className="text-sm text-slate-700">{label}</div>
        {ayuda && <div className="mt-0.5 text-xs text-slate-400">{ayuda}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => ajustar(-1)}
          disabled={valor <= min}
          className="h-8 w-8 rounded-md border border-slate-300 text-lg font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-slate-800">{valor}</span>
        <button
          type="button"
          onClick={() => ajustar(1)}
          disabled={valor >= max}
          className="h-8 w-8 rounded-md border border-slate-300 text-lg font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}

function Switch({
  activo,
  label,
  onChange
}: {
  activo: boolean
  label: string
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!activo)}
        className={`relative h-6 w-11 rounded-full transition ${activo ? 'bg-slate-900' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            activo ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}
