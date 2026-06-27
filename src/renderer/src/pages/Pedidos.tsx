import { useEffect, useMemo, useRef, useState } from 'react'
import type { DetalleOrden, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { TicketCocina, agruparPorComensal } from '@renderer/components/TicketCocina'
import { SelectorModificadores } from '@renderer/components/SelectorModificadores'
import { useToast } from '@renderer/components/Toast'
import { useImpresion } from '@renderer/store/impresion'
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
    enviarACocina,
    marcarPorCobrar,
    cancelarOrden
  } = useDatos()
  const toast = useToast()
  const { imprimirCocina } = useImpresion()
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

  const [ticket, setTicket] = useState<{ lineas: DetalleOrden[]; adicional: boolean } | null>(null)
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

  // Al cambiar de orden, reinicia el comensal activo.
  useEffect(() => {
    setComensalActivo(1)
    setNumComensales(1)
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

  const handleEnviar = async (): Promise<void> => {
    const adicional = !primerEnvio
    // Envía TODO lo pendiente (de todos los comensales); el ticket los agrupa.
    const nuevas = await enviarACocina(orden.id)
    if (nuevas.length > 0) {
      setTicket({ lineas: nuevas, adicional })
      const total = nuevas.reduce((acc, d) => acc + d.cantidad, 0)
      toast(`${total} ${total === 1 ? 'producto enviado' : 'productos enviados'} a cocina`)
      // Impresión de la comanda en la térmica de cocina.
      try {
        await imprimirCocina(titulo, nuevas, { adicional })
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No se pudo imprimir la comanda', 'error')
      }
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
                      onClick={() => cambiarCantidad(orden.id, d.id, -1)}
                      disabled={d.enviadoCocina}
                      className="h-7 w-7 rounded-md bg-black/[0.05] font-bold text-tinta-suave enabled:hover:bg-black/[0.08] disabled:opacity-30"
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
            onClick={() => setConfirmarCancel(true)}
            className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
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
        titulo="Ticket de cocina"
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
          <TicketCocina titulo={titulo} lineas={ticket.lineas} adicional={ticket.adicional} />
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
