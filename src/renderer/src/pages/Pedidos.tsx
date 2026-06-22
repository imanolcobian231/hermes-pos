import { useEffect, useMemo, useRef, useState } from 'react'
import type { DetalleOrden, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { TicketCocina } from '@renderer/components/TicketCocina'
import { SelectorModificadores } from '@renderer/components/SelectorModificadores'
import { useToast } from '@renderer/components/Toast'
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

  const orden = ordenPorId(ordenId)

  const categoriasOrdenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden),
    [categorias]
  )
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(
    categoriasOrdenadas[0]?.id ?? null
  )
  const [busqueda, setBusqueda] = useState('')

  const [ticket, setTicket] = useState<DetalleOrden[] | null>(null)
  const [notaLinea, setNotaLinea] = useState<DetalleOrden | null>(null)
  const [notaTexto, setNotaTexto] = useState('')
  const [confirmarCancel, setConfirmarCancel] = useState(false)
  // Producto cuyo selector de modificadores está abierto.
  const [modProducto, setModProducto] = useState<Producto | null>(null)
  const notaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (notaLinea) {
      setNotaTexto(notaLinea.notas ?? '')
      setTimeout(() => notaRef.current?.focus(), 50)
    }
  }, [notaLinea])

  if (!orden) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">Abriendo orden…</div>
    )
  }

  const guardarNota = (): void => {
    if (notaLinea) void cambiarNota(orden.id, notaLinea.id, notaTexto)
    setNotaLinea(null)
  }

  const tocarProducto = (p: Producto): void => {
    if (p.grupos && p.grupos.length > 0) {
      setModProducto(p)
    } else {
      void agregarProducto(orden.id, p)
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
  const huboEnviosPrevios = orden.detalle.some((d) => d.enviadoCocina)

  const handleEnviar = async (): Promise<void> => {
    const nuevas = await enviarACocina(orden.id)
    if (nuevas.length > 0) {
      setTicket(nuevas)
      const total = nuevas.reduce((acc, d) => acc + d.cantidad, 0)
      toast(`${total} ${total === 1 ? 'producto enviado' : 'productos enviados'} a cocina`)
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
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Icono nombre="volver" size={16} />
            Mesas
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{titulo}</h1>
            <p className="text-sm text-slate-500">
              {subtitulo} · orden #{orden.id}
            </p>
          </div>
        </header>

        {/* Buscador */}
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icono nombre="buscar" size={16} />
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
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
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
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
              className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
            >
              <span className="font-semibold text-slate-800">{p.nombre}</span>
              <span className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">{pesos(p.precio)}</span>
                {p.grupos && p.grupos.length > 0 && (
                  <span className="text-[10px] font-semibold uppercase text-slate-400">opciones</span>
                )}
              </span>
            </button>
          ))}
          {productosVisibles.length === 0 && (
            <p className="text-sm text-slate-400">No hay productos en esta categoría.</p>
          )}
        </div>
      </section>

      {/* Comanda */}
      <aside className="flex w-96 flex-col rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-800">Comanda</h2>
        </header>

        <div className="flex-1 overflow-auto px-3 py-2">
          {orden.detalle.length === 0 && (
            <p className="px-2 py-8 text-center text-sm text-slate-400">
              Toca un producto para agregarlo
            </p>
          )}
          {orden.detalle.map((d) => (
            <div key={d.id} className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{d.nombreProducto}</span>
                  {d.enviadoCocina && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      enviado
                    </span>
                  )}
                </div>
                {d.modificadores.map((m) => (
                  <div key={m.id} className="text-xs text-slate-500">
                    + {m.nombre}
                    {m.precio > 0 && ` (${pesos(m.precio)})`}
                  </div>
                ))}
                <button
                  onClick={() => setNotaLinea(d)}
                  className="text-left text-xs text-slate-400 hover:text-slate-600"
                >
                  {d.notas ? `Nota: ${d.notas}` : '+ nota'}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => cambiarCantidad(orden.id, d.id, -1)}
                  disabled={d.enviadoCocina}
                  className="h-7 w-7 rounded-md bg-slate-100 font-bold text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold">{d.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(orden.id, d.id, +1)}
                  className="h-7 w-7 rounded-md bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
                >
                  +
                </button>
              </div>

              <span className="w-16 pt-1 text-right font-semibold text-slate-700">
                {pesos(d.cantidad * d.precioUnitario)}
              </span>
            </div>
          ))}
        </div>

        <footer className="border-t border-slate-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-lg">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="font-bold text-slate-900">{pesos(orden.total)}</span>
          </div>

          <button
            onClick={handleEnviar}
            disabled={!hayPendientes}
            className="mb-2 w-full rounded-md bg-slate-900 py-2.5 font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {huboEnviosPrevios ? 'Enviar adicional a cocina' : 'Enviar a cocina'}
          </button>
          <button
            onClick={handleCobrar}
            disabled={orden.detalle.length === 0 || hayPendientes}
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 font-semibold text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
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
            void agregarProducto(orden.id, modProducto, ids)
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
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Listo
          </button>
        }
      >
        {ticket && <TicketCocina titulo={titulo} lineas={ticket} adicional={huboEnviosPrevios} />}
      </Modal>

      <Modal
        abierto={notaLinea !== null}
        titulo={`Nota · ${notaLinea?.nombreProducto ?? ''}`}
        onCerrar={() => setNotaLinea(null)}
        pie={
          <>
            <button
              onClick={() => setNotaLinea(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={guardarNota}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <p className="mt-2 text-xs text-slate-400">
          La nota se imprime en el ticket de cocina junto al producto.
        </p>
      </Modal>

      <ConfirmDialog
        abierto={confirmarCancel}
        titulo="Cancelar orden"
        peligro
        textoConfirmar="Sí, cancelar"
        textoCancelar="No"
        mensaje={
          <>
            Se cancelará la orden de <strong>{titulo}</strong>.
            {huboEnviosPrevios && (
              <span className="mt-2 block font-medium text-amber-700">
                Advertencia: ya se enviaron productos a cocina.
              </span>
            )}
          </>
        }
        onConfirmar={() => {
          void cancelarOrden(orden.id)
          setConfirmarCancel(false)
          toast(`Orden cancelada`, 'info')
          onVolver()
        }}
        onCancelar={() => setConfirmarCancel(false)}
      />
    </div>
  )
}
