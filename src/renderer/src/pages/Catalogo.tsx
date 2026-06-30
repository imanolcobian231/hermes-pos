import { useMemo, useState } from 'react'
import type { Categoria, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'
import { AsignarGrupos } from '@renderer/components/AsignarGrupos'
import { GestorModificadores } from '@renderer/components/GestorModificadores'

type Pestana = 'productos' | 'categorias' | 'modificadores'

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'productos', label: 'Productos' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'modificadores', label: 'Modificadores' }
]

export function Catalogo(): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>('productos')

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-tinta">Catálogo</h1>
        <p className="text-sm text-tinta-suave">Administra productos, categorías y modificadores</p>
      </header>

      <div className="mb-5 flex gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              pestana === p.id
                ? 'bg-acento text-white'
                : 'bg-white text-tinta-suave hover:bg-black/[0.08]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestana === 'productos' && <PanelProductos />}
      {pestana === 'categorias' && <PanelCategorias />}
      {pestana === 'modificadores' && <GestorModificadores />}
    </div>
  )
}

// --- Productos --------------------------------------------------------------

function PanelProductos(): React.JSX.Element {
  const { productos, categorias, guardarProducto, eliminarProducto } = useDatos()
  const toast = useToast()
  const [editando, setEditando] = useState<Partial<Producto> | null>(null)
  const [aEliminar, setAEliminar] = useState<Producto | null>(null)

  const nombreCategoria = (id: number): string =>
    categorias.find((c) => c.id === id)?.nombre ?? '—'

  const nuevo = (): void =>
    setEditando({ nombre: '', precio: 0, categoriaId: categorias[0]?.id, activo: true })

  return (
    <div className="flex-1 overflow-auto">
      <div className="mb-3 flex justify-end">
        <button
          onClick={nuevo}
          disabled={categorias.length === 0}
          className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-acento-hover disabled:bg-black/10 disabled:text-tinta-suave/50"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5">Categoría</th>
              <th className="px-4 py-2.5 text-right">Precio</th>
              <th className="px-4 py-2.5 text-right">Stock</th>
              <th className="px-4 py-2.5 text-center">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-black/[0.04]">
                <td className="px-4 py-2.5 font-medium text-tinta">{p.nombre}</td>
                <td className="px-4 py-2.5 text-tinta-suave">{nombreCategoria(p.categoriaId)}</td>
                <td className="px-4 py-2.5 text-right text-tinta">{pesos(p.precio)}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.controlarStock ? (
                    <span
                      className={`font-semibold ${
                        p.stock <= p.stockMinimo ? 'text-amber-600' : 'text-tinta'
                      }`}
                    >
                      {p.stock}
                      {p.stock <= p.stockMinimo && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          bajo
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-tinta-suave/50">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      p.activo ? 'bg-acento text-white' : 'bg-black/[0.05] text-tinta-suave'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditando(p)}
                      className="rounded-md p-1.5 text-tinta-suave hover:bg-black/[0.05] hover:text-tinta"
                      aria-label="Editar"
                    >
                      <Icono nombre="editar" size={16} />
                    </button>
                    <button
                      onClick={() => setAEliminar(p)}
                      className="rounded-md p-1.5 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Icono nombre="eliminar" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-tinta-suave">
                  No hay productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar producto' : 'Nuevo producto'}
        ancho="max-w-lg"
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button
              onClick={() => setEditando(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!editando?.nombre?.trim() || editando.categoriaId == null) return
                const esNuevo = editando.id == null
                guardarProducto({
                  id: editando.id,
                  nombre: editando.nombre.trim(),
                  precio: Number(editando.precio) || 0,
                  categoriaId: editando.categoriaId,
                  activo: editando.activo ?? true,
                  descripcion: editando.descripcion,
                  controlarStock: editando.controlarStock ?? false,
                  stock: Number(editando.stock) || 0,
                  stockMinimo: Number(editando.stockMinimo) || 0,
                  costo: Number(editando.costo) || 0
                })
                setEditando(null)
                toast(esNuevo ? 'Producto creado' : 'Producto actualizado')
              }}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
              Guardar
            </button>
          </>
        }
      >
        {editando && (
          <div className="flex flex-col gap-3">
            <Campo label="Nombre">
              <input
                value={editando.nombre ?? ''}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              />
            </Campo>
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Precio">
                <input
                  type="number"
                  value={editando.precio ?? 0}
                  onChange={(e) => setEditando({ ...editando, precio: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                />
              </Campo>
              <Campo label="Costo">
                <input
                  type="number"
                  value={editando.costo ?? 0}
                  onChange={(e) => setEditando({ ...editando, costo: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                />
              </Campo>
              <Campo label="Categoría">
                <select
                  value={editando.categoriaId ?? ''}
                  onChange={(e) =>
                    setEditando({ ...editando, categoriaId: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm text-tinta-suave">
              <input
                type="checkbox"
                checked={editando.activo ?? true}
                onChange={(e) => setEditando({ ...editando, activo: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Producto activo (visible en pedidos)
            </label>

            {/* Control de inventario: descuenta stock automáticamente al vender */}
            <div className="rounded-xl border border-black/[0.06] p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-tinta">
                <input
                  type="checkbox"
                  checked={editando.controlarStock ?? false}
                  onChange={(e) => setEditando({ ...editando, controlarStock: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Controlar inventario
              </label>
              {editando.controlarStock && (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Campo label="Stock actual">
                      <input
                        type="number"
                        value={editando.stock ?? 0}
                        onChange={(e) => setEditando({ ...editando, stock: Number(e.target.value) })}
                        className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                      />
                    </Campo>
                    <Campo label="Stock mínimo">
                      <input
                        type="number"
                        value={editando.stockMinimo ?? 0}
                        onChange={(e) => setEditando({ ...editando, stockMinimo: Number(e.target.value) })}
                        className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                      />
                    </Campo>
                  </div>
                  <p className="mt-2 text-xs text-tinta-suave/80">
                    El stock baja solo al cobrar y se repone al devolver la venta.
                  </p>
                </>
              )}
            </div>

            {editando.id != null ? (
              <AsignarGrupos productoId={editando.id} />
            ) : (
              <p className="mt-2 border-t border-black/[0.04] pt-3 text-xs text-tinta-suave">
                Guarda el producto para poder asignarle grupos de modificadores.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar producto"
        peligro
        textoConfirmar="Eliminar"
        mensaje={
          <>
            ¿Eliminar <strong>{aEliminar?.nombre}</strong> del catálogo? Esta acción no se puede
            deshacer.
          </>
        }
        onConfirmar={() => {
          if (aEliminar) {
            eliminarProducto(aEliminar.id)
            toast(`${aEliminar.nombre} eliminado`, 'info')
          }
          setAEliminar(null)
        }}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

// --- Categorías -------------------------------------------------------------

function PanelCategorias(): React.JSX.Element {
  const { categorias, productos, guardarCategoria, eliminarCategoria } = useDatos()
  const toast = useToast()
  // Área de impresión de la categoría (sin marcar → Cocina).
  const etiquetaArea = (rol?: 'cocina' | 'barra'): string => (rol === 'barra' ? 'Barra' : 'Cocina')
  const [editando, setEditando] = useState<Partial<Categoria> | null>(null)
  const [aEliminar, setAEliminar] = useState<Categoria | null>(null)

  const ordenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden),
    [categorias]
  )

  const cuenta = (catId: number): number =>
    productos.filter((p) => p.categoriaId === catId).length

  return (
    <div className="flex-1 overflow-auto">
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setEditando({ nombre: '', orden: (ordenadas.at(-1)?.orden ?? 0) + 1 })}
          className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
        >
          + Nueva categoría
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ordenadas.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-4 py-3"
          >
            <div>
              <span className="font-semibold text-tinta">{c.nombre}</span>
              <span className="ml-2 text-xs text-tinta-suave">
                {cuenta(c.id)} {cuenta(c.id) === 1 ? 'producto' : 'productos'}
              </span>
              <span className="ml-2 text-xs">
                <span className="rounded-full bg-acento/10 px-2 py-0.5 font-semibold text-acento">
                  🖨 {etiquetaArea(c.rol)}
                </span>
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setEditando(c)}
                className="rounded-md p-1.5 text-tinta-suave hover:bg-black/[0.05] hover:text-tinta"
                aria-label="Editar"
              >
                <Icono nombre="editar" size={16} />
              </button>
              <button
                onClick={() => cuenta(c.id) === 0 && setAEliminar(c)}
                disabled={cuenta(c.id) > 0}
                title={cuenta(c.id) > 0 ? 'Mueve o elimina sus productos primero' : ''}
                className="rounded-md p-1.5 text-tinta-suave enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:text-tinta-suave/40"
                aria-label="Eliminar"
              >
                <Icono nombre="eliminar" size={16} />
              </button>
            </div>
          </div>
        ))}
        {ordenadas.length === 0 && (
          <p className="py-8 text-center text-tinta-suave">No hay categorías</p>
        )}
      </div>

      <Modal
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar categoría' : 'Nueva categoría'}
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button
              onClick={() => setEditando(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!editando?.nombre?.trim()) return
                const esNueva = editando.id == null
                guardarCategoria({
                  id: editando.id,
                  nombre: editando.nombre.trim(),
                  orden: Number(editando.orden) || 1,
                  rol: editando.rol
                })
                setEditando(null)
                toast(esNueva ? 'Categoría creada' : 'Categoría actualizada')
              }}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
              Guardar
            </button>
          </>
        }
      >
        {editando && (
          <div className="flex flex-col gap-3">
            <Campo label="Nombre">
              <input
                value={editando.nombre ?? ''}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              />
            </Campo>
            <Campo label="Orden">
              <input
                type="number"
                value={editando.orden ?? 1}
                onChange={(e) => setEditando({ ...editando, orden: Number(e.target.value) })}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              />
            </Campo>
            <Campo label="Área de impresión">
              <select
                value={editando.rol === 'barra' ? 'barra' : 'cocina'}
                onChange={(e) =>
                  setEditando({ ...editando, rol: e.target.value === 'barra' ? 'barra' : 'cocina' })
                }
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              >
                <option value="cocina">Cocina</option>
                <option value="barra">Barra</option>
              </select>
              <p className="mt-1 text-xs text-tinta-suave">
                Cocina o Barra. Con una sola impresora salen como tickets separados; con varias, cada
                área va a la impresora de su rol.
              </p>
            </Campo>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar categoría"
        peligro
        textoConfirmar="Eliminar"
        mensaje={
          <>
            ¿Eliminar la categoría <strong>{aEliminar?.nombre}</strong>?
          </>
        }
        onConfirmar={() => {
          if (aEliminar) {
            eliminarCategoria(aEliminar.id)
            toast(`Categoría ${aEliminar.nombre} eliminada`, 'info')
          }
          setAEliminar(null)
        }}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

function Campo({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-tinta-suave">{label}</label>
      {children}
    </div>
  )
}
