import { useEffect, useMemo, useState } from 'react'
import type { Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { SelectorModificadores } from '@renderer/components/SelectorModificadores'
import { Icono } from '@renderer/components/Icono'

interface Props {
  /** Pasa al cobro la orden del carrito. */
  onCobrar: (ordenId: number) => void
}

// Venta rápida (modo tiendita): se tocan productos para armar un carrito y se
// cobra directo. El "carrito" es una orden para llevar viva; tocar un producto
// lo agrega (agrupa cantidades). No hay mesas ni envío a cocina.
export function Tienda({ onCobrar }: Props): React.JSX.Element {
  const {
    categorias,
    productos,
    ordenPorId,
    abrirOrdenLlevar,
    agregarProducto,
    cambiarCantidad,
    quitarLinea,
    marcarPorCobrar
  } = useDatos()

  const categoriasOrdenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden),
    [categorias]
  )
  // "Todos" por defecto (categoriaActiva = null).
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ordenId, setOrdenId] = useState<number | null>(null)
  const [modProducto, setModProducto] = useState<Producto | null>(null)
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
    if (p.grupos && p.grupos.length > 0) setModProducto(p)
    else void agregar(p)
  }

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
            className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition ${
              categoriaActiva === null
                ? 'border-acento bg-acento text-white'
                : 'border-black/[0.06] bg-white text-tinta-suave hover:border-black/15 hover:bg-black/[0.03]'
            }`}
          >
            Todos
          </button>
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

        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3 overflow-auto pr-1">
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

      {/* Carrito */}
      <aside className="flex w-96 flex-col rounded-lg border border-black/[0.06] bg-white">
        <header className="border-b border-black/[0.04] px-5 py-3">
          <h2 className="text-lg font-bold text-tinta">Venta</h2>
          <p className="text-xs text-tinta-suave">Toca productos para agregarlos al ticket</p>
        </header>

        <div className="flex-1 overflow-auto px-3 py-2">
          {!orden || orden.detalle.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-tinta-suave">El ticket está vacío</p>
          ) : (
            orden.detalle.map((d) => (
              <div
                key={d.id}
                className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-black/[0.03]"
              >
                <div className="flex-1">
                  <span className="font-medium text-tinta">{d.nombreProducto}</span>
                  {d.modificadores.map((m) => (
                    <div key={m.id} className="text-xs text-tinta-suave">
                      + {m.nombre}
                      {m.precio > 0 && ` (${pesos(m.precio)})`}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => cambiarCantidad(orden.id, d.id, -1)}
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
                  onClick={() => quitarLinea(orden.id, d.id)}
                  title="Quitar"
                  className="mt-0.5 rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                >
                  <Icono nombre="eliminar" size={15} />
                </button>
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
            className="w-full rounded-md bg-acento py-2.5 font-semibold text-white transition enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
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
    </div>
  )
}
