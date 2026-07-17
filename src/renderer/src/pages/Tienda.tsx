import { useEffect, useMemo, useRef, useState } from 'react'
import type { DetalleOrden, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos, capitalizar } from '@renderer/lib/format'
import { SelectorModificadores } from '@renderer/components/SelectorModificadores'
import { CuadriculaVirtual } from '@renderer/components/CuadriculaVirtual'
import { CantidadEditable } from '@renderer/components/CantidadEditable'
import { TicketsRecientes } from '@renderer/components/TicketsRecientes'
import { DescuentoLineaDialog } from '@renderer/components/DescuentoLineaDialog'
import { Icono } from '@renderer/components/Icono'
import { useToast } from '@renderer/components/Toast'

interface Props {
  /** Pasa al cobro la orden del carrito. */
  onCobrar: (ordenId: number) => void
  /** Producto llegado por escaneo global (App lo detecta desde cualquier pantalla). */
  escaneado?: { producto: Producto; nonce: number } | null
  /** Aviso a App de que ya se consumió el escaneo (para limpiarlo). */
  onEscaneoConsumido?: () => void
}

// Venta rápida (modo tiendita): se tocan productos para armar un carrito y se
// cobra directo. El "carrito" es una orden para llevar viva; tocar un producto
// lo agrega (agrupa cantidades). No hay mesas ni envío a cocina.
export function Tienda({ onCobrar, escaneado, onEscaneoConsumido }: Props): React.JSX.Element {
  const {
    categorias,
    productos,
    cobradas,
    ordenPorId,
    abrirOrdenLlevar,
    agregarProducto,
    cambiarCantidad,
    descontarLinea,
    quitarLinea,
    marcarPorCobrar
  } = useDatos()
  const toast = useToast()
  // Línea seleccionada para aplicarle un descuento (abre el diálogo).
  const [descLinea, setDescLinea] = useState<DetalleOrden | null>(null)

  const categoriasOrdenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden),
    [categorias]
  )
  // "Todos" por defecto (categoriaActiva = null).
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ordenId, setOrdenId] = useState<number | null>(null)
  const [modProducto, setModProducto] = useState<Producto | null>(null)
  // Últimos tickets del turno (reimprimir / nota de venta).
  const [verTickets, setVerTickets] = useState(false)
  // Cantidad vendida por producto, para ordenar por popularidad.
  const [ventas, setVentas] = useState<Record<number, number>>({})

  useEffect(() => {
    void window.api.catalogo.masVendidos().then((arr) => {
      setVentas(Object.fromEntries(arr.map((v) => [v.productoId, v.vendido])))
    })
  }, [])

  const orden = ordenId != null ? ordenPorId(ordenId) : null

  // Agrega un producto al carrito; crea la orden la primera vez.
  const agregar = async (producto: Producto, modificadorIds: number[] = []): Promise<void> => {
    let id = ordenId
    if (id == null) {
      const o = await abrirOrdenLlevar()
      id = o.id
      setOrdenId(id)
    }
    await agregarProducto(id, producto, modificadorIds, 1)
  }

  const tocarProducto = (p: Producto): void => {
    if (p.controlarStock && p.stock <= 0) {
      toast('No hay más existencia de este producto', 'error')
      return
    }
    if (p.grupos && p.grupos.length > 0) setModProducto(p)
    else void agregar(p)
  }

  // Producto llegado por escaneo global (App lo detecta desde cualquier pantalla
  // y navega aquí). El nonce evita re-procesar el mismo escaneo (incl. StrictMode).
  const ultimoScan = useRef<number | null>(null)
  useEffect(() => {
    if (!escaneado || escaneado.nonce === ultimoScan.current) return
    ultimoScan.current = escaneado.nonce
    setBusqueda('')
    tocarProducto(escaneado.producto)
    onEscaneoConsumido?.()
  }, [escaneado?.nonce])

  const cobrar = async (): Promise<void> => {
    if (ordenId == null || !orden || orden.detalle.length === 0) return
    await marcarPorCobrar(ordenId)
    const id = ordenId
    setOrdenId(null)
    onCobrar(id)
  }

  const termino = busqueda.trim().toLowerCase()
  const productosVisibles = productos
    .filter((p) => {
      if (!p.activo) return false
      if (termino) return p.nombre.toLowerCase().includes(termino)
      return categoriaActiva == null || p.categoriaId === categoriaActiva
    })
    // Más vendidos primero; a igualdad, por nombre.
    .sort(
      (a, b) => (ventas[b.id] ?? 0) - (ventas[a.id] ?? 0) || a.nombre.localeCompare(b.nombre)
    )

  return (
    <div className="flex h-full gap-6">
      {/* Catálogo */}
      <section className="flex flex-1 flex-col">
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

        <div className={`mb-4 flex flex-wrap gap-2 ${termino ? 'opacity-40' : ''}`}>
          <button
            onClick={() => setCategoriaActiva(null)}
            className={`rounded-md border px-4 py-2.5 text-base font-semibold transition ${
              categoriaActiva === null
                ? 'border-acento bg-acento text-white'
                : 'border-black/[0.06] bg-white text-tinta-suave hover:border-black/15 hover:bg-black/[0.03]'
            }`}
          >
            Todos
          </button>
          {/* Se omite una categoría llamada "Todos": el filtro virtual de arriba ya
              muestra todo, así no aparece duplicada. */}
          {categoriasOrdenadas
            .filter((c) => c.nombre.trim().toLowerCase() !== 'todos')
            .map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaActiva(c.id)}
              className={`rounded-md border px-4 py-2.5 text-base font-semibold transition ${
                categoriaActiva === c.id
                  ? 'border-acento bg-acento text-white'
                  : 'border-black/[0.06] bg-white text-tinta-suave hover:border-black/15 hover:bg-black/[0.03]'
              }`}
            >
              {capitalizar(c.nombre)}
            </button>
          ))}
        </div>

        <CuadriculaVirtual
          items={productosVisibles}
          keyOf={(p) => p.id}
          minColAncho={200}
          altoFila={128}
          renderItem={(p) => {
            const agotado = p.controlarStock && p.stock <= 0
            return (
              <button
                onClick={() => tocarProducto(p)}
                disabled={agotado}
                className={`relative flex h-full w-full flex-col justify-between gap-1 overflow-hidden rounded-xl border border-black/[0.06] bg-white p-4 text-left transition ${
                  agotado ? 'cursor-not-allowed opacity-50' : 'hover:border-black/20'
                }`}
              >
                {p.color && (
                  <span className="absolute inset-x-0 top-0 h-2" style={{ backgroundColor: p.color }} />
                )}
                <span className="line-clamp-2 text-lg font-semibold leading-tight text-tinta">
                  {p.nombre}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-bold tabular-nums text-tinta">{pesos(p.precio)}</span>
                  {agotado ? (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                      agotado
                    </span>
                  ) : (
                    p.grupos &&
                    p.grupos.length > 0 && (
                      <span className="text-[10px] font-semibold uppercase text-tinta-suave">opciones</span>
                    )
                  )}
                </span>
              </button>
            )
          }}
          vacio={<p className="text-sm text-tinta-suave">No hay productos en esta categoría.</p>}
        />
      </section>

      {/* Carrito */}
      <aside className="flex w-96 flex-col rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b border-black/[0.04] px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-tinta">Venta</h2>
            <p className="text-xs text-tinta-suave">Toca productos para agregarlos al ticket</p>
          </div>
          <button
            onClick={() => setVerTickets(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-acento/20 bg-acento/[0.06] px-3.5 py-2 text-xs font-semibold text-acento transition hover:border-acento/40 hover:bg-acento/10 active:scale-95"
            title="Reimprimir tickets de venta del turno"
          >
            <Icono nombre="recibo" size={15} />
            Últimos tickets
          </button>
        </header>

        <div className="flex-1 overflow-auto px-3 py-2">
          {!orden || orden.detalle.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-tinta-suave">El ticket está vacío</p>
          ) : (
            orden.detalle.map((d) => (
              <div
                key={d.id}
                className="flex items-start gap-1 rounded-lg px-2 py-2 hover:bg-black/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-tinta">{d.nombreProducto}</span>
                  {d.modificadores.map((m) => (
                    <div key={m.id} className="text-xs text-tinta-suave">
                      + {m.nombre}
                      {m.precio > 0 && ` (${pesos(m.precio)})`}
                    </div>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => cambiarCantidad(orden.id, d.id, -1)}
                    className="h-9 w-9 shrink-0 rounded-md bg-black/[0.05] text-base font-bold text-tinta-suave hover:bg-black/[0.08]"
                  >
                    −
                  </button>
                  <CantidadEditable
                    valor={d.cantidad}
                    onFijar={(n) => {
                      const delta = n - d.cantidad
                      if (delta !== 0) void cambiarCantidad(orden.id, d.id, delta)
                    }}
                  />
                  <button
                    onClick={() => cambiarCantidad(orden.id, d.id, +1)}
                    className="h-9 w-9 shrink-0 rounded-md bg-black/[0.05] text-base font-bold text-tinta-suave hover:bg-black/[0.08]"
                  >
                    +
                  </button>
                </div>
                <span className="w-16 shrink-0 whitespace-nowrap pt-0.5 text-right text-sm tabular-nums">
                  {d.descuento > 0 ? (
                    <>
                      <span className="block text-[10px] font-normal text-tinta-suave line-through">
                        {pesos(d.cantidad * d.precioUnitario)}
                      </span>
                      <span className="font-semibold text-tinta">
                        {pesos(d.cantidad * d.precioUnitario - d.descuento)}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-tinta">
                      {pesos(d.cantidad * d.precioUnitario)}
                    </span>
                  )}
                </span>
                <div className="mt-0.5 flex shrink-0 flex-col">
                  <button
                    onClick={() => setDescLinea(d)}
                    title="Descuento"
                    className={`rounded-md p-1 ${
                      d.descuento > 0
                        ? 'text-acento'
                        : 'text-tinta-suave hover:bg-black/[0.05] hover:text-tinta'
                    }`}
                  >
                    <Icono nombre="gasto" size={15} />
                  </button>
                  <button
                    onClick={() => quitarLinea(orden.id, d.id)}
                    title="Quitar"
                    className="rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                  >
                    <Icono nombre="eliminar" size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="border-t border-black/[0.04] px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-lg">
            <span className="font-semibold text-tinta-suave">Total</span>
            <span className="font-bold text-tinta">{pesos(orden?.total ?? 0)}</span>
          </div>
          <button
            onClick={() => void cobrar()}
            disabled={!orden || orden.detalle.length === 0}
            className="w-full rounded-md bg-acento py-3.5 text-base font-semibold text-white transition enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
          >
            Cobrar
          </button>
        </footer>
      </aside>

      {modProducto && (
        <SelectorModificadores
          producto={modProducto}
          onCerrar={() => setModProducto(null)}
          onConfirmar={(ids) => {
            void agregar(modProducto, ids)
            setModProducto(null)
          }}
        />
      )}

      <TicketsRecientes
        abierto={verTickets}
        titulo="Últimos tickets del turno"
        tickets={cobradas}
        vacio="Aún no hay ventas en el turno."
        onCerrar={() => setVerTickets(false)}
      />

      <DescuentoLineaDialog
        linea={descLinea}
        onCerrar={() => setDescLinea(null)}
        onAplicar={(monto) => {
          if (descLinea) void descontarLinea(descLinea.id, monto)
          setDescLinea(null)
        }}
      />
    </div>
  )
}
