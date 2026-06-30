import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConfigRespaldo, Impresora, RespaldoInfo } from '@shared/types'
import { useImpresion } from '@renderer/store/impresion'
import { useToast } from '@renderer/components/Toast'
import { fechaHora } from '@renderer/lib/format'
import { pngALogo, logoAVistaPrevia } from '@renderer/lib/logo'
import { Modal } from '@renderer/components/Modal'
import { Icono } from '@renderer/components/Icono'

const BAUDIOS = [9600, 19200, 38400, 57600, 115200]

export function Ajustes(): React.JSX.Element {
  const { cfg, aviso, limpiarAviso, actualizarCfg } = useImpresion()
  const toast = useToast()
  const [negocio, setNegocio] = useState({
    nombreNegocio: '',
    direccion: '',
    telefono: '',
    rfc: '',
    mensajeTicket: ''
  })

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
        telefono: cfg.telefono,
        rfc: cfg.rfc ?? '',
        mensajeTicket: cfg.mensajeTicket ?? 'Gracias por su visita'
      })
    }
  }, [cfg?.nombreNegocio, cfg?.direccion, cfg?.telefono, cfg?.rfc, cfg?.mensajeTicket])

  const guardarNegocio = (): void => {
    void actualizarCfg({
      nombreNegocio: negocio.nombreNegocio.trim(),
      direccion: negocio.direccion.trim(),
      telefono: negocio.telefono.trim(),
      rfc: negocio.rfc.trim(),
      mensajeTicket: negocio.mensajeTicket.trim()
    })
  }

  if (!cfg) {
    return <div className="flex h-full items-center justify-center text-tinta-suave">Cargando…</div>
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-tinta">Ajustes</h1>
        <p className="text-sm text-tinta-suave">Impresoras térmicas (Bluetooth o puerto COM)</p>
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
              multilinea
              placeholder={'Ej.\nAv. Juárez 123\nCol. Centro\nCiudad, CP 00000'}
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
            <CampoNegocio
              label="RFC"
              valor={negocio.rfc}
              placeholder="Ej. XAXX010101000"
              onChange={(v) => setNegocio((n) => ({ ...n, rfc: v }))}
              onGuardar={guardarNegocio}
            />
            <CampoNegocio
              label="Mensaje del ticket"
              valor={negocio.mensajeTicket}
              placeholder="Ej. ¡Gracias por su compra!"
              onChange={(v) => setNegocio((n) => ({ ...n, mensajeTicket: v }))}
              onGuardar={guardarNegocio}
            />
          </div>
          <p className="mt-2 text-xs text-tinta-suave">
            Aparecen como encabezado en los tickets. Déjalos vacíos para no imprimirlos.
          </p>
        </Seccion>

        {/* Modo de venta */}
        <Seccion titulo="Modo de venta">
          <Switch
            activo={cfg.modoTiendita === true}
            label="Modo tiendita (venta rápida de productos)"
            onChange={(v) => void actualizarCfg({ modoTiendita: v })}
          />
          <p className="text-xs text-tinta-suave">
            La pantalla principal muestra los productos para vender directo (carrito) en vez de
            mesas. Ideal para tiendas o abarrotes.
          </p>
        </Seccion>

        {/* Logo del ticket */}
        <SeccionLogo />

        {/* Impresoras (varias, con rol) */}
        <SeccionImpresoras />

        {/* Impuestos */}
        <SeccionImpuestos />

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
          <Switch
            activo={cfg.separarBarra !== false}
            label="Separar comandas de Barra y Cocina"
            onChange={(v) => void actualizarCfg({ separarBarra: v })}
          />
          <Switch
            activo={cfg.confirmarEntreTickets === true}
            label="Confirmar entre comandas (impresoras sin corte)"
            onChange={(v) => void actualizarCfg({ confirmarEntreTickets: v })}
          />
          <Switch
            activo={cfg.separarComensales !== false}
            label="Separar la comanda de cocina por comensal"
            onChange={(v) => void actualizarCfg({ separarComensales: v })}
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

        <p className="text-xs text-tinta-suave">
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
  multilinea,
  onChange,
  onGuardar
}: {
  label: string
  valor: string
  placeholder?: string
  multilinea?: boolean
  onChange: (v: string) => void
  onGuardar: () => void
}): React.JSX.Element {
  const clase =
    'w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15'
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-tinta-suave">{label}</label>
      {multilinea ? (
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onGuardar}
          placeholder={placeholder}
          rows={3}
          className={`${clase} resize-y`}
        />
      ) : (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onGuardar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder={placeholder}
          className={clase}
        />
      )}
      {multilinea && (
        <p className="mt-1 text-xs text-tinta-suave">Cada renglón se imprime en una línea aparte.</p>
      )}
    </div>
  )
}

// Logo del negocio para el encabezado del ticket. El PNG se rasteriza a un mapa
// de bits monocromo (en el renderer) y se guarda en la config; el ancho destino
// depende del tamaño de papel (58/80 mm). La vista previa muestra exactamente
// cómo saldrá impreso (blanco y negro).
function SeccionLogo(): React.JSX.Element {
  const { cfg, impresoras, actualizarCfg } = useImpresion()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [procesando, setProcesando] = useState(false)

  const logo = cfg?.logoTicket ?? null
  // El logo se imprime en la de Caja: usa su ancho de papel. Ocupa ~la mitad del
  // rollo (384/576 puntos), reducido otro 25%, y recortado al contenido.
  const cajaAncho = impresoras.find((i) => i.id === cfg?.impresoraCajaId)?.ancho ?? cfg?.ancho ?? 32
  const anchoPuntos = Math.round(((cajaAncho === 48 ? 576 : 384) / 2) * 0.75)
  const vista = useMemo(() => (logo ? logoAVistaPrevia(logo) : null), [logo])

  const elegir = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setProcesando(true)
    try {
      const raster = await pngALogo(file, anchoPuntos)
      await actualizarCfg({ logoTicket: raster })
      toast('Logo guardado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo procesar la imagen', 'error')
    } finally {
      setProcesando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Seccion titulo="Logo del ticket">
      <p className="mb-3 text-sm text-tinta-suave">
        Imagen que se imprime arriba del ticket de cobro. Se convierte a blanco y negro a{' '}
        {anchoPuntos} puntos de ancho (según tu tamaño de papel).
      </p>

      {vista && (
        <div className="mb-3 flex items-center gap-4 rounded-lg border border-black/[0.06] bg-black/[0.02] p-3">
          <img
            src={vista}
            alt="Vista previa del logo"
            className="max-h-28 w-auto border border-black/10 bg-white"
          />
          <div className="text-xs text-tinta-suave">
            <div className="font-semibold text-tinta">Así se imprimirá</div>
            <div>
              {logo?.ancho} × {logo?.alto} puntos
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/*"
        className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={procesando}
          className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
        >
          {procesando ? 'Procesando…' : vista ? 'Cambiar logo' : 'Elegir imagen PNG'}
        </button>
        {vista && (
          <button
            onClick={() => void actualizarCfg({ logoTicket: null })}
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Quitar logo
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        Para mejor resultado usa un PNG de alto contraste (logo o texto en negro sobre fondo
        transparente o blanco). Las fotos se difuminan en blanco y negro.
      </p>
    </Seccion>
  )
}

// Impuestos del negocio: lista editable (nombre + tasa). El negocio puede tener
// uno (IVA) o varios. Si la lista está vacía, se usa el IVA único de respaldo.
function SeccionImpuestos(): React.JSX.Element {
  const { cfg, actualizarCfg } = useImpresion()
  if (!cfg) return <></>
  const impuestos =
    cfg.impuestos && cfg.impuestos.length > 0
      ? cfg.impuestos
      : [{ nombre: 'IVA', tasa: cfg.impuestoTasa || 16 }]

  const guardar = (lista: { nombre: string; tasa: number }[]): void =>
    void actualizarCfg({ impuestos: lista })
  const cambiar = (i: number, parcial: Partial<{ nombre: string; tasa: number }>): void =>
    guardar(impuestos.map((imp, idx) => (idx === i ? { ...imp, ...parcial } : imp)))

  return (
    <Seccion titulo="Impuestos">
      <Switch
        activo={cfg.impuestoActivo}
        label="Aplicar impuestos al ticket"
        onChange={(v) => void actualizarCfg({ impuestoActivo: v })}
      />
      {cfg.impuestoActivo && (
        <>
          <div className="mt-2 flex flex-col gap-2">
            {impuestos.map((imp, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={imp.nombre}
                  onChange={(e) => cambiar(i, { nombre: e.target.value })}
                  placeholder="Nombre (ej. IVA, IEPS)"
                  className="flex-1 rounded-md border border-black/10 px-2 py-1 text-sm outline-none focus:border-acento"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={imp.tasa}
                  onChange={(e) => cambiar(i, { tasa: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-16 rounded-md border border-black/10 px-2 py-1 text-right text-sm outline-none focus:border-acento"
                />
                <span className="text-sm text-tinta-suave">%</span>
                <button
                  onClick={() => guardar(impuestos.filter((_, idx) => idx !== i))}
                  title="Quitar impuesto"
                  className="rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                >
                  <Icono nombre="eliminar" size={15} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => guardar([...impuestos, { nombre: 'Impuesto', tasa: 0 }])}
            className="mt-2 rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            + Agregar impuesto
          </button>
          <div className="mt-3">
            <Switch
              activo={cfg.impuestoIncluido}
              label="Los precios ya incluyen los impuestos"
              onChange={(v) => void actualizarCfg({ impuestoIncluido: v })}
            />
          </div>
          <p className="text-xs text-tinta-suave">
            Activado: el ticket solo desglosa los impuestos (el total no cambia). Desactivado: se
            suman al total y el cliente paga más.
          </p>
        </>
      )}
    </Seccion>
  )
}

// Sección que gestiona TODAS las impresoras del negocio (agregar, conectar,
// asignar rol de Caja, probar, eliminar). El ruteo por categoría se hace en
// Catálogo; el ticket de cobro va a la marcada como Caja.
function SeccionImpresoras(): React.JSX.Element {
  const { impresoras, cfg, actualizarCfg, agregarImpresora } = useImpresion()
  const [nueva, setNueva] = useState('')

  const modo = cfg?.modo ?? 'una'
  const cajaId = cfg?.impresoraCajaId ?? 'caja'
  const cajaImp = impresoras.find((i) => i.id === cajaId) ?? impresoras[0]

  const agregar = (): void => {
    if (!nueva.trim()) return
    void agregarImpresora(nueva)
    setNueva('')
  }

  return (
    <Seccion titulo="Impresoras">
      {/* Modo: una o varias */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <OpcionModo
          activo={modo === 'una'}
          titulo="Una impresora"
          detalle="La misma imprime el cobro y las comandas."
          onClick={() => void actualizarCfg({ modo: 'una' })}
        />
        <OpcionModo
          activo={modo === 'multiple'}
          titulo="Varias (por rol)"
          detalle="Caja, Barra y Cocina; la comanda se rutea por categoría."
          onClick={() => void actualizarCfg({ modo: 'multiple' })}
        />
      </div>

      {modo === 'una' ? (
        <>
          <p className="mb-3 text-sm text-tinta-suave">
            Conecta tu impresora: imprimirá tanto el ticket de cobro como las comandas.
          </p>
          {cajaImp ? (
            <FilaImpresora impresora={cajaImp} />
          ) : (
            <p className="text-sm text-tinta-suave">No hay impresora configurada.</p>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-tinta-suave">
            Conecta cada impresora. La marcada como <strong>Caja</strong> imprime el ticket de cobro;
            en <strong>Catálogo</strong> eliges a qué impresora va la comanda de cada categoría.
          </p>
          <div className="flex flex-col gap-3">
            {impresoras.map((imp) => (
              <FilaImpresora key={imp.id} impresora={imp} mostrarRoles />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              placeholder="Agregar impresora extra (ej. Cocina 2)"
              className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
            />
            <button
              onClick={agregar}
              className="rounded-full bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
              Agregar
            </button>
          </div>
        </>
      )}
    </Seccion>
  )
}

// Una impresora de la lista: nombre editable, roles (Caja/Cocina/Barra),
// conexión (BLE/COM), prueba y eliminar. `mostrarRoles` muestra los botones de
// rol (solo en modo "varias impresoras").
function FilaImpresora({
  impresora,
  mostrarRoles
}: {
  impresora: Impresora
  mostrarRoles?: boolean
}): React.JSX.Element {
  const {
    cfg,
    estados,
    conectando,
    conectar,
    desconectar,
    configurarCom,
    listarPuertos,
    imprimirPrueba,
    renombrarImpresora,
    eliminarImpresora,
    marcarRol,
    cambiarAnchoImpresora
  } = useImpresion()
  const toast = useToast()
  const estado = estados[impresora.id] ?? { conectado: false, nombre: null }
  const configurada = impresora.tipo != null
  // Los 3 roles predefinidos no se eliminan (siempre presentes).
  const esPredefinida = ['caja', 'barra', 'cocina'].includes(impresora.id)
  // Roles que cumple esta impresora actualmente.
  const roles: { rol: 'caja' | 'cocina' | 'barra'; label: string; activo: boolean }[] = [
    { rol: 'caja', label: 'Caja', activo: cfg?.impresoraCajaId === impresora.id },
    { rol: 'cocina', label: 'Cocina', activo: cfg?.impresoraCocinaId === impresora.id },
    { rol: 'barra', label: 'Barra', activo: cfg?.impresoraBarraId === impresora.id }
  ]

  const [nombre, setNombre] = useState(impresora.nombre)
  const [probando, setProbando] = useState(false)
  const [editandoConexion, setEditandoConexion] = useState(false)
  const [modoCom, setModoCom] = useState(impresora.tipo === 'com')
  const [puertos, setPuertos] = useState<string[]>([])
  const [cargandoPuertos, setCargandoPuertos] = useState(false)
  const [puerto, setPuerto] = useState(impresora.puerto ?? '')
  const [baud, setBaud] = useState(impresora.baudRate ?? 9600)

  const conectandoBle = conectando === impresora.id

  const refrescarPuertos = async (): Promise<void> => {
    setCargandoPuertos(true)
    try {
      const lista = await listarPuertos()
      setPuertos(lista)
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

  const conectarBle = async (): Promise<void> => {
    await conectar(impresora.id)
    setEditandoConexion(false)
  }

  const guardarCom = async (): Promise<void> => {
    if (!puerto) {
      toast('Elige un puerto COM (empareja antes la impresora en Windows)', 'error')
      return
    }
    await configurarCom(impresora.id, puerto, baud)
    setEditandoConexion(false)
    toast('Impresora por COM guardada', 'info')
  }

  const probar = async (): Promise<void> => {
    setProbando(true)
    try {
      await imprimirPrueba(impresora.id)
      toast('Ticket de prueba enviado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir la prueba', 'error')
    } finally {
      setProbando(false)
    }
  }

  const detalle = configurada
    ? impresora.tipo === 'com'
      ? `COM ${impresora.puerto ?? ''}${estado.conectado ? '' : ' · no disponible'}`
      : `Bluetooth${estado.conectado ? '' : ' · no disponible'}`
    : 'Sin conexión'

  return (
    <div className="rounded-xl border border-black/[0.06] p-3">
      {/* Encabezado: nombre + rol + estado */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${estado.conectado ? 'bg-emerald-500' : configurada ? 'bg-amber-500' : 'bg-black/15'}`}
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre !== impresora.nombre && void renombrarImpresora(impresora.id, nombre)}
          className="min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 font-semibold text-tinta outline-none hover:border-black/10 focus:border-acento"
        />
        {mostrarRoles &&
          roles.map((r) => (
            <button
              key={r.rol}
              onClick={() => void marcarRol(impresora.id, r.rol)}
              title={`Marcar como ${r.label}`}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                r.activo
                  ? 'bg-acento text-white'
                  : 'border border-black/10 text-tinta-suave hover:bg-black/[0.05]'
              }`}
            >
              {r.label}
            </button>
          ))}
        {!esPredefinida && (
          <button
            onClick={() => void eliminarImpresora(impresora.id)}
            className="rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
            title="Eliminar impresora"
          >
            <Icono nombre="eliminar" size={15} />
          </button>
        )}
      </div>

      <div className="mt-1 pl-4.5 text-xs text-tinta-suave">{detalle}</div>

      {/* Tamaño de papel de ESTA impresora */}
      <div className="mt-2 flex items-center gap-2 pl-4.5">
        <span className="text-xs text-tinta-suave">Papel:</span>
        {[
          { v: 32, label: '58 mm' },
          { v: 48, label: '80 mm' }
        ].map((o) => {
          const activo = (impresora.ancho ?? cfg?.ancho ?? 32) === o.v
          return (
            <button
              key={o.v}
              onClick={() => void cambiarAnchoImpresora(impresora.id, o.v)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                activo
                  ? 'bg-acento text-white'
                  : 'border border-black/10 text-tinta-suave hover:bg-black/[0.05]'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Conexión */}
      {configurada && !editandoConexion ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void probar()}
            disabled={probando}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta hover:bg-black/[0.05] disabled:opacity-40"
          >
            <Icono nombre="imprimir" size={14} />
            {probando ? 'Imprimiendo…' : 'Probar'}
          </button>
          <button
            onClick={() => {
              setModoCom(impresora.tipo === 'com')
              setEditandoConexion(true)
            }}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Reconfigurar
          </button>
          <button
            onClick={() => desconectar(impresora.id)}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Quitar
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-black/[0.06] p-3">
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
              onClick={() => void conectarBle()}
              disabled={conectandoBle}
              className="w-full rounded-md bg-acento px-3 py-2 text-sm font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
            >
              {conectandoBle ? 'Buscando…' : 'Conectar por Bluetooth'}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-tinta-suave">Puerto</label>
                <div className="flex gap-2">
                  <select
                    value={puerto}
                    onChange={(e) => setPuerto(e.target.value)}
                    className="flex-1 rounded-md border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-acento"
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
                    className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05] disabled:opacity-50"
                  >
                    {cargandoPuertos ? '…' : '↻'}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-tinta-suave">Baudios</label>
                <select
                  value={baud}
                  onChange={(e) => setBaud(Number(e.target.value))}
                  className="w-full rounded-md border border-black/10 px-2 py-1.5 text-sm outline-none focus:border-acento"
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
                className="w-full rounded-md bg-acento px-3 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
              >
                Guardar impresora COM
              </button>
            </div>
          )}
        </div>
      )}
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
          ? 'border-acento bg-black/[0.05] text-tinta'
          : 'border-black/[0.06] text-tinta-suave hover:border-black/15'
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
    <section className="rounded-xl border border-black/[0.06] bg-white p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-tinta-suave">{titulo}</h2>
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
  const [aRestaurar, setARestaurar] = useState<RespaldoInfo | null>(null)

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
    'rounded-md border border-black/10 px-3 py-1.5 text-xs font-semibold text-tinta hover:bg-black/[0.05] disabled:opacity-50'

  if (!cfg) {
    return (
      <Seccion titulo="Respaldos">
        <p className="text-sm text-tinta-suave">Cargando…</p>
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
      <div className="mt-2 rounded-lg border border-black/[0.06] p-3">
        <div className="mb-1 text-xs font-medium text-tinta-suave">Carpeta de respaldos</div>
        <div className="mb-3 break-all text-sm text-tinta">
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
            className="rounded-md bg-acento px-3 py-1.5 text-xs font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
          >
            {ocupado ? 'Respaldando…' : 'Respaldar ahora'}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        {cfg.ultimo ? `Último respaldo: ${fechaHora(cfg.ultimo)}` : 'Aún no se ha hecho ningún respaldo.'}
      </p>
      {lista.length > 0 && (
        <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-black/[0.06]">
          {lista.map((r) => (
            <div
              key={r.ruta}
              className="flex items-center justify-between gap-2 border-b border-black/[0.04] px-3 py-1.5 text-xs last:border-0"
            >
              <span className="text-tinta-suave">{fechaHora(r.fecha)}</span>
              <div className="flex items-center gap-2">
                <span className="text-tinta-suave">{Math.max(1, Math.round(r.tamano / 1024))} KB</span>
                <button
                  onClick={() => setARestaurar(r)}
                  className="rounded border border-black/10 px-2 py-0.5 font-semibold text-tinta-suave hover:bg-black/[0.05]"
                >
                  Restaurar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-tinta-suave">
        Se conservan los últimos 14 respaldos. Guarda la carpeta en una USB o servicio en la nube
        para no perder la información si falla el equipo.
      </p>

      <Modal
        abierto={aRestaurar !== null}
        titulo="Restaurar respaldo"
        onCerrar={() => setARestaurar(null)}
        pie={
          <>
            <button
              onClick={() => setARestaurar(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const nombre = aRestaurar?.nombre
                if (!nombre) return
                // Antes de restaurar se crea un respaldo de seguridad del estado
                // actual. La app se recarga sola al terminar.
                void window.api.respaldo.restaurar(nombre)
                setARestaurar(null)
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Restaurar y reiniciar
            </button>
          </>
        }
      >
        {aRestaurar && (
          <p className="text-sm text-tinta-suave">
            Se reemplazará toda la información actual por la del respaldo del{' '}
            <strong>{fechaHora(aRestaurar.fecha)}</strong>. Se hará un respaldo de seguridad del
            estado actual antes de hacerlo, y la app se reiniciará. ¿Continuar?
          </p>
        )}
      </Modal>
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
        activo ? 'border-acento bg-black/[0.05]' : 'border-black/[0.06] hover:border-black/15'
      }`}
    >
      <div className="font-semibold text-tinta">{titulo}</div>
      <div className="mt-0.5 text-xs text-tinta-suave">{detalle}</div>
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
        <div className="text-sm text-tinta">{label}</div>
        {ayuda && <div className="mt-0.5 text-xs text-tinta-suave">{ayuda}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => ajustar(-1)}
          disabled={valor <= min}
          className="h-8 w-8 rounded-md border border-black/10 text-lg font-semibold text-tinta-suave hover:bg-black/[0.05] disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-tinta">{valor}</span>
        <button
          type="button"
          onClick={() => ajustar(1)}
          disabled={valor >= max}
          className="h-8 w-8 rounded-md border border-black/10 text-lg font-semibold text-tinta-suave hover:bg-black/[0.05] disabled:opacity-40"
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
      <span className="text-sm text-tinta">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!activo)}
        className={`relative h-6 w-11 rounded-full transition ${activo ? 'bg-acento' : 'bg-black/15'}`}
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
