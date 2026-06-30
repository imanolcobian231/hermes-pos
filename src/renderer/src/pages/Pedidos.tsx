import { useEffect, useMemo, useRef, useState } from 'react'
import type { DetalleOrden, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { TicketCocina, agruparPorComensal } from '@renderer/components/TicketCocina'
import { SelectorModificadores } from '@renderer/components/SelectorModificadores'
import { useToast } from '@renderer/components/Toast'
import { useImpresion } from '@renderer/store/impresion'
import { comandasPorArea, rolesConfigurados, type GrupoComanda } from '@renderer/lib/comandas'
import { useAuth } from '@renderer/store/auth'
import { useAutorizacion } from '@renderer/store/autorizacion'
import { Icono } from '@renderer/components/Icono'

interface Props {
  ordenId: number
  titulo: string
  subtitulo: string
  onVolver: () => void
  onCobrar: (ordenId: number) => void
}

export function Pedidos({ ordenId, titulo, subtitulo, onVolver, onCobrar }: Props): React.JSX.Element {
  const {
    categorias,
    productos,
    ordenPorId,
    agregarProducto,
    cambiarCantidad,
    cambiarNota,
    quitarLinea,
    enviarACocina,
    marcarPorCobrar,
    cancelarOrden,
    registrarReimpresion
  } = useDatos()
  const toast = useToast()
  const { imprimirComandas, cfg, impresoras } = useImpresion()
  const { usuarioActual } = useAuth()
  const { pedir } = useAutorizacion()

  const orden = ordenPorId(ordenId)

  const categoriasOrdenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden),
    [categorias]
  )
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(
    categoriasOrdenadas[0]?.id ?? null
  )
  const [busqueda, setBusqueda] = useState('')

  const [ticket, setTicket] = useState<{
    comandas: { area: 'cocina' | 'barra'; lineas: DetalleOrden[] }[]
    adicional: boolean
    reimpresion?: boolean
    correccion?: boolean
  } | null>(null)
  // Hubo un quitado/resta de algo ya enviado: la próxima reimpresión es CORRECCION.
  const [huboQuitado, setHuboQuitado] = useState(false)
  // Cola de comandas pendientes por imprimir una por una con confirmación
  // (impresoras sin corte). `anteriorArea` = la que se acaba de imprimir.
  const [colaImpresion, setColaImpresion] = useState<{
    grupos: GrupoComanda[]
    opciones: { adicional?: boolean; reimpresion?: boolean; cancelacion?: boolean }
    anteriorArea: 'cocina' | 'barra'
  } | null>(null)
  const [notaLinea, setNotaLinea] = useState<DetalleOrden | null>(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [confirmarCancel, setConfirmarCancel] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')
  // Producto cuyo selector de modificadores está abierto.
  const [modProducto, setModProducto] = useState<Producto | null>(null)
  // Comensal activo y cuántos comensales hay en la orden.
  const [comensalActivo, setComensalActivo] = useState(1)
  const [numComensales, setNumComensales] = useState(1)
  const notaRef = useRef<HTMLInputElement>(null)
  // Candado para no imprimir de más por doble clic en "Imprimir siguiente".
  const colaBusy = useRef(false)

  // Al cambiar de orden, reinicia el comensal activo.
  useEffect(() => {
    setComensalActivo(1)
    setNumComensales(1)
    setHuboQuitado(false)
  }, [ordenId])

  useEffect(() => {
    if (notaLinea) {
      setNotaTexto(notaLinea.notas ?? '')
      setTimeout(() => notaRef.current?.focus(), 50)
    }
  }, [notaLinea])

  if (!orden) {
    return (
      <div className="flex h-full items-center justify-center text-tinta-suave">Abriendo orden…</div>
    )
  }

  const guardarNota = (): void => {
    if (notaLinea) void cambiarNota(orden.id, notaLinea.id, notaTexto)
    setNotaLinea(null)
  }

  // Quita un producto. No enviado: directo. Enviado: pide PIN y lo quita (NO
  // reimprime solo; el usuario pulsa "Reimprimir comanda" cuando quiera avisar).
  const quitar = (d: DetalleOrden): void => {
    if (!d.enviadoCocina) {
      void quitarLinea(orden.id, d.id)
      return
    }
    pedir(() => {
      void quitarLinea(orden.id, d.id)
      setHuboQuitado(true)
      toast('Producto quitado · pulsa "Reimprimir comanda" para avisar a cocina', 'info')
    }, 'Quitar un producto ya enviado a cocina')
  }

  // Resta una unidad. No enviado: directo. Enviado: pide PIN; si llega a 0, quita
  // la línea completa. Tampoco reimprime solo.
  const restar = (d: DetalleOrden): void => {
    if (!d.enviadoCocina) {
      void cambiarCantidad(orden.id, d.id, -1)
      return
    }
    if (d.cantidad <= 1) {
      quitar(d)
      return
    }
    pedir(() => {
      void cambiarCantidad(orden.id, d.id, -1)
      setHuboQuitado(true)
      toast('Cantidad corregida · pulsa "Reimprimir comanda" para avisar a cocina', 'info')
    }, 'Quitar una unidad ya enviada a cocina')
  }

  // Total de comensales = el mayor entre los seleccionados y los ya usados en líneas.
  const maxComensalLineas = orden.detalle.reduce((m, d) => Math.max(m, d.comensal ?? 1), 1)
  const totalComensales = Math.max(numComensales, maxComensalLineas)

  const tocarProducto = (p: Producto): void => {
    if (p.grupos && p.grupos.length > 0) {
      setModProducto(p)
    } else {
      void agregarProducto(orden.id, p, [], comensalActivo)
    }
  }

  const termino = busqueda.trim().toLowerCase()
  const productosVisibles = productos.filter((p) => {
    if (!p.activo) return false
    // Al buscar se ignora la categoría activa y se busca en todo el catálogo.
    if (termino) return p.nombre.toLowerCase().includes(termino)
    return categoriaActiva == null || p.categoriaId === categoriaActiva
  })

  const hayPendientes = orden.detalle.some((d) => !d.enviadoCocina)
  // Si ya se envió algo antes, el envío actual es "adicional".
  const primerEnvio = !orden.detalle.some((d) => d.enviadoCocina)

  // Agrupa las líneas en comandas por área (cocina/barra). En modo "una" todo va
  // a Caja, pero igual separado por área.
  const repartir = (lineas: DetalleOrden[]): ReturnType<typeof comandasPorArea> =>
    comandasPorArea(
      lineas,
      productos,
      categorias,
      rolesConfigurados(impresoras, cfg?.impresoraCocinaId ?? null, cfg?.impresoraBarraId ?? null),
      cfg?.modo === 'una' ? cfg.impresoraCajaId ?? null : null,
      cfg?.separarBarra !== false
    )

  // Imprime los grupos. Los del mismo destino se concatenan y van en UNA sola
  // sesión Bluetooth (sin demora de reconectar entre los dos tickets).
  const enviarGrupos = async (
    grupos: GrupoComanda[],
    opciones: { adicional?: boolean; reimpresion?: boolean; cancelacion?: boolean }
  ): Promise<void> => {
    const unaComanda = (
      g: GrupoComanda
    ): { impresoraId: string; titulo: string; lineas: DetalleOrden[]; opciones: typeof opciones & { area: 'cocina' | 'barra' } } => ({
      impresoraId: g.impresoraId,
      titulo,
      lineas: g.lineas,
      opciones: { ...opciones, area: g.area }
    })
    // Si hay 2+ comandas y se pidió confirmar entre tickets: imprime la primera y
    // las demás esperan tu confirmación (para cortar a mano). Si no, todas juntas.
    if (cfg?.confirmarEntreTickets && grupos.length > 1) {
      try {
        await imprimirComandas([unaComanda(grupos[0])])
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No se pudo imprimir la comanda', 'error')
      }
      setColaImpresion({ grupos: grupos.slice(1), opciones, anteriorArea: grupos[0].area })
      return
    }
    await imprimirComandas(grupos.map(unaComanda))
  }

  // Imprime la siguiente comanda de la cola (tras pulsar Listo) y avanza. El
  // candado evita que un doble clic imprima varias veces.
  const imprimirSiguienteEnCola = async (): Promise<void> => {
    if (!colaImpresion || colaBusy.current) return
    colaBusy.current = true
    const [g, ...resto] = colaImpresion.grupos
    // Avanza/cierra el modal de inmediato para que no se pueda re-disparar.
    setColaImpresion(
      resto.length > 0 ? { grupos: resto, opciones: colaImpresion.opciones, anteriorArea: g.area } : null
    )
    try {
      await imprimirComandas([
        { impresoraId: g.impresoraId, titulo, lineas: g.lineas, opciones: { ...colaImpresion.opciones, area: g.area } }
      ])
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir la comanda', 'error')
    } finally {
      colaBusy.current = false
    }
  }

  // Para la vista previa: los grupos como { area, lineas }.
  const aComandasPreview = (grupos: GrupoComanda[]): { area: 'cocina' | 'barra'; lineas: DetalleOrden[] }[] =>
    grupos.map((g) => ({ area: g.area, lineas: g.lineas }))

  const handleEnviar = async (): Promise<void> => {
    const adicional = !primerEnvio
    // Envía TODO lo pendiente (de todos los comensales); el ticket los agrupa.
    const nuevas = await enviarACocina(orden.id)
    if (nuevas.length > 0) {
      const { grupos, sinImpresora } = repartir(nuevas)
      setTicket({ comandas: aComandasPreview(grupos), adicional })
      const total = nuevas.reduce((acc, d) => acc + d.cantidad, 0)
      toast(`${total} ${total === 1 ? 'producto enviado' : 'productos enviados'} a cocina`)
      if (sinImpresora.length > 0) {
        toast('Hay productos sin impresora de comanda (revísalo en Ajustes)', 'error')
      }
      try {
        await enviarGrupos(grupos, { adicional })
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No se pudo imprimir la comanda', 'error')
      }
    }
  }

  // Reimprime la comanda de cocina. Si hubo un quitado/resta es una CORRECCION:
  // primero manda los pendientes (lo recién agregado) y luego imprime la comanda
  // corregida COMPLETA. Si no hubo cambios, es una REIMPRESION de lo ya enviado.
  const reimprimirCocina = async (): Promise<void> => {
    const correccion = huboQuitado
    // En una corrección, lo nuevo (pendiente) también entra: márcalo enviado.
    if (correccion && orden.detalle.some((d) => !d.enviadoCocina)) {
      await enviarACocina(orden.id)
    }
    const lineas = correccion
      ? orden.detalle
      : orden.detalle.filter((d) => d.enviadoCocina)
    if (lineas.length === 0) return
    const { grupos } = repartir(lineas)
    void registrarReimpresion('cocina', orden.id, usuarioActual?.nombre)
    setTicket({
      comandas: aComandasPreview(grupos),
      adicional: false,
      reimpresion: !correccion,
      correccion
    })
    try {
      await enviarGrupos(grupos, correccion ? { cancelacion: true } : { reimpresion: true })
      setHuboQuitado(false)
      toast(correccion ? 'Corrección enviada a cocina' : 'Comanda de cocina reimpresa', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo reimprimir la comanda', 'error')
    }
  }

  const handleCobrar = async (): Promise<void> => {
    await marcarPorCobrar(orden.id)
    onCobrar(orden.id)
  }

  return (
    <div className="flex h-full gap-6">
      {/* Catálogo */}
      <section className="flex flex-1 flex-col">
        <header className="mb-4 flex items-center gap-3">
          <button
            onClick={onVolver}
            className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            <Icono nombre="volver" size={16} />
            Mesas
          </button>
          <div>
            <h1 className="text-2xl font-bold text-tinta">{titulo}</h1>
            <p className="text-sm text-tinta-suave">
              {subtitulo} · orden #{orden.id}
            </p>
          </div>
        </header>

        {/* Buscador */}
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
            <Icono nombre="buscar" size={16} />
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-md border border-black/10 py-2 pl-9 pr-9 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-tinta-suave hover:text-tinta"
              aria-label="Limpiar búsqueda"
            >
              <Icono nombre="cerrar" size={15} />
            </button>
          )}
        </div>

        {/* Pestañas de categoría */}
        <div className={`mb-4 flex flex-wrap gap-2 ${termino ? 'opacity-40' : ''}`}>
          {categoriasOrdenadas.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaActiva(c.id)}
              className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
                categoriaActiva === c.id
                  ? 'border-acento bg-acento text-white'
                  : 'border-black/[0.06] bg-white text-tinta-suave hover:border-black/15 hover:bg-black/[0.03]'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-3 overflow-auto pr-1">
          {productosVisibles.map((p) => (
            <button
              key={p.id}
              onClick={() => tocarProducto(p)}
              className="flex flex-col justify-between gap-2 rounded-lg border border-black/[0.06] bg-white p-4 text-left transition hover:border-black/20"
            >
              <span className="font-semibold text-tinta">{p.nombre}</span>
              <span className="flex items-center justify-between">
                <span className="text-base font-bold text-tinta">{pesos(p.precio)}</span>
                {p.grupos && p.grupos.length > 0 && (
                  <span className="text-[10px] font-semibold uppercase text-tinta-suave">opciones</span>
                )}
              </span>
            </button>
          ))}
          {productosVisibles.length === 0 && (
            <p className="text-sm text-tinta-suave">No hay productos en esta categoría.</p>
          )}
        </div>
      </section>

      {/* Comanda */}
      <aside className="flex w-96 flex-col rounded-lg border border-black/[0.06] bg-white">
        <header className="border-b border-black/[0.04] px-5 py-3">
          <h2 className="mb-2 text-lg font-bold text-tinta">Comanda</h2>
          {/* Selector de comensal */}
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: totalComensales }, (_, i) => i + 1).map((c) => (
              <button
                key={c}
                onClick={() => setComensalActivo(c)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  comensalActivo === c
                    ? 'border-acento bg-acento text-white'
                    : 'border-black/[0.06] text-tinta-suave hover:border-black/20'
                }`}
              >
                Comensal {c}
              </button>
            ))}
            <button
              onClick={() => {
                const nuevo = totalComensales + 1
                setNumComensales(nuevo)
                setComensalActivo(nuevo)
              }}
              className="rounded-md border border-dashed border-black/10 px-2 py-1 text-xs font-semibold text-tinta-suave hover:border-black/20"
              title="Agregar comensal"
            >
              + Comensal
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-3 py-2">
          {orden.detalle.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-tinta-suave">
              Toca un producto para agregarlo al comensal {comensalActivo}
            </p>
          )}
          {agruparPorComensal(orden.detalle).map(([comensal, items]) => {
            const subtotalComensal = items.reduce((s, d) => s + d.cantidad * d.precioUnitario, 0)
            const activo = comensal === comensalActivo
            return (
            <div
              key={comensal}
              className={`mb-3 overflow-hidden rounded-lg ${
                totalComensales > 1
                  ? activo
                    ? 'border-2 border-acento'
                    : 'border border-black/[0.06]'
                  : ''
              }`}
            >
              {totalComensales > 1 && (
                <div
                  className={`flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                    activo ? 'bg-acento text-white' : 'bg-black/[0.05] text-tinta-suave'
                  }`}
                >
                  <span>
                    Comensal {comensal}
                    {activo && ' · aquí'}
                  </span>
                  <span>{pesos(subtotalComensal)}</span>
                </div>
              )}
              {items.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-black/[0.03]"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-tinta">{d.nombreProducto}</span>
                      {d.enviadoCocina && (
                        <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-tinta-suave">
                          enviado
                        </span>
                      )}
                    </div>
                    {d.modificadores.map((m) => (
                      <div key={m.id} className="text-xs text-tinta-suave">
                        + {m.nombre}
                        {m.precio > 0 && ` (${pesos(m.precio)})`}
                      </div>
                    ))}
                    <button
                      onClick={() => setNotaLinea(d)}
                      className="text-left text-xs text-tinta-suave hover:text-tinta"
                    >
                      {d.notas ? `Nota: ${d.notas}` : '+ nota'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => restar(d)}
                      title={d.enviadoCocina ? 'Restar (ya enviado: pide autorización)' : 'Restar'}
                      className="h-7 w-7 rounded-md bg-black/[0.05] font-bold text-tinta-suave hover:bg-black/[0.08]"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold">{d.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(orden.id, d.id, +1)}
                      className="h-7 w-7 rounded-md bg-black/[0.05] font-bold text-tinta-suave hover:bg-black/[0.08]"
                    >
                      +
                    </button>
                  </div>

                  <span className="w-16 pt-1 text-right font-semibold text-tinta">
                    {pesos(d.cantidad * d.precioUnitario)}
                  </span>

                  <button
                    onClick={() => quitar(d)}
                    title={d.enviadoCocina ? 'Quitar (ya enviado: pide autorización)' : 'Quitar producto'}
                    className="mt-0.5 rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                  >
                    <Icono nombre="eliminar" size={15} />
                  </button>
                </div>
              ))}
            </div>
            )
          })}
        </div>

        <footer className="border-t border-black/[0.04] px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-lg">
            <span className="font-semibold text-tinta-suave">Total</span>
            <span className="font-bold text-tinta">{pesos(orden.total)}</span>
          </div>

          <button
            onClick={handleEnviar}
            disabled={!hayPendientes}
            className="mb-2 w-full rounded-md bg-acento py-2.5 font-semibold text-white transition enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
          >
            {primerEnvio ? 'Enviar a cocina' : 'Enviar pendientes a cocina'}
          </button>
          <button
            onClick={handleCobrar}
            disabled={orden.detalle.length === 0 || hayPendientes}
            className="w-full rounded-md border border-black/10 bg-white py-2.5 font-semibold text-tinta transition enabled:hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:border-black/[0.06] disabled:text-tinta-suave/40"
            title={hayPendientes ? 'Envía todo a cocina antes de cobrar' : ''}
          >
            Pasar a cobro
          </button>
          <button
            onClick={() => void reimprimirCocina()}
            disabled={!huboQuitado && !orden.detalle.some((d) => d.enviadoCocina)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold text-tinta-suave transition enabled:hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:text-tinta-suave/40"
            title="Vuelve a imprimir en cocina lo ya enviado (por si se perdió o hubo un error)"
          >
            <Icono nombre="imprimir" size={15} />
            {huboQuitado ? 'Enviar corrección a cocina' : 'Reimprimir comanda'}
          </button>
          <button
            onClick={() => setConfirmarCancel(true)}
            className="mt-1 w-full rounded-lg py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
          >
            Cancelar orden
          </button>
        </footer>
      </aside>

      {modProducto && (
        <SelectorModificadores
          producto={modProducto}
          onCerrar={() => setModProducto(null)}
          onConfirmar={(ids) => {
            void agregarProducto(orden.id, modProducto, ids, comensalActivo)
            setModProducto(null)
          }}
        />
      )}

      <Modal
        abierto={ticket !== null}
        titulo={
          ticket?.correccion
            ? 'Corrección de comanda'
            : ticket?.reimpresion
              ? 'Reimpresión de comanda'
              : 'Ticket de cocina'
        }
        onCerrar={() => setTicket(null)}
        pie={
          <button
            onClick={() => setTicket(null)}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
          >
            Listo
          </button>
        }
      >
        {ticket && (
          <div className="flex flex-col gap-3">
            {ticket.comandas.map((c, i) => (
              <TicketCocina
                key={i}
                titulo={titulo}
                lineas={c.lineas}
                area={c.area}
                adicional={ticket.adicional}
                reimpresion={ticket.reimpresion}
                correccion={ticket.correccion}
              />
            ))}
          </div>
        )}
      </Modal>

      {/* Impresión secuencial con confirmación (impresoras sin corte) */}
      <Modal
        abierto={colaImpresion !== null}
        titulo="Imprimir comandas"
        onCerrar={() => setColaImpresion(null)}
        pie={
          <>
            <button
              onClick={() => setColaImpresion(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Terminar
            </button>
            <button
              onClick={() => void imprimirSiguienteEnCola()}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
              Imprimir{' '}
              {colaImpresion?.grupos[0]?.area === 'barra' ? 'Barra' : 'Cocina'}
            </button>
          </>
        }
      >
        {colaImpresion && (
          <p className="text-sm text-tinta-suave">
            Se imprimió la comanda de{' '}
            <strong>{colaImpresion.anteriorArea === 'barra' ? 'Barra' : 'Cocina'}</strong>. Córtala y
            pulsa <strong>Imprimir {colaImpresion.grupos[0].area === 'barra' ? 'Barra' : 'Cocina'}</strong>{' '}
            para la siguiente.
          </p>
        )}
      </Modal>

      <Modal
        abierto={notaLinea !== null}
        titulo={`Nota · ${notaLinea?.nombreProducto ?? ''}`}
        onCerrar={() => setNotaLinea(null)}
        pie={
          <>
            <button
              onClick={() => setNotaLinea(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={guardarNota}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
              Guardar
            </button>
          </>
        }
      >
        <input
          ref={notaRef}
          value={notaTexto}
          onChange={(e) => setNotaTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardarNota()}
          placeholder="Ej. sin cebolla, bien dorado…"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
        />
        <p className="mt-2 text-xs text-tinta-suave">
          La nota se imprime en el ticket de cocina junto al producto.
        </p>
      </Modal>

      <Modal
        abierto={confirmarCancel}
        titulo="Cancelar orden"
        onCerrar={() => {
          setConfirmarCancel(false)
          setMotivoCancel('')
        }}
        pie={
          <>
            <button
              onClick={() => {
                setConfirmarCancel(false)
                setMotivoCancel('')
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              No
            </button>
            <button
              disabled={!motivoCancel.trim()}
              onClick={() => {
                const id = orden.id
                const m = motivoCancel.trim()
                pedir((pin) => {
                  void cancelarOrden(id, m, usuarioActual?.nombre, pin)
                  setConfirmarCancel(false)
                  setMotivoCancel('')
                  toast('Orden cancelada', 'info')
                  onVolver()
                }, 'Cancelar una orden')
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              Sí, cancelar
            </button>
          </>
        }
      >
        <p className="text-sm text-tinta-suave">
          Se cancelará la orden de <strong>{titulo}</strong>.
        </p>
        {orden.detalle.some((d) => d.enviadoCocina) && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            Advertencia: ya se enviaron productos a cocina.
          </p>
        )}
        <label className="mb-1 mt-4 block text-sm font-medium text-tinta-suave">
          Motivo de la cancelación
        </label>
        <input
          autoFocus
          value={motivoCancel}
          onChange={(e) => setMotivoCancel(e.target.value)}
          placeholder="Ej. cliente se fue, error de captura…"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {['Cliente se fue', 'Error de captura', 'Producto agotado', 'Cortesía'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivoCancel(m)}
              className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-tinta-suave hover:bg-black/[0.05]"
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-tinta-suave">
          El motivo queda registrado en el corte para auditoría.
        </p>
      </Modal>
    </div>
  )
}
