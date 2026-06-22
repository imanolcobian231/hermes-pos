import { useMemo, useState } from 'react'
import type { Categoria, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'
import { ModificadoresEditor } from '@renderer/components/ModificadoresEditor'

type Pestana = 'productos' | 'categorias'

export function Catalogo(): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>('productos')

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Catálogo</h1>
        <p className="text-sm text-slate-500">Administra productos y categorías</p>
      </header>

      <div className="mb-5 flex gap-2">
        {(['productos', 'categorias'] as Pestana[]).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              pestana === p ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {pestana === 'productos' ? <PanelProductos /> : <PanelCategorias />}
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
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5">Categoría</th>
              <th className="px-4 py-2.5 text-right">Precio</th>
              <th className="px-4 py-2.5 text-center">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.nombre}</td>
                <td className="px-4 py-2.5 text-slate-600">{nombreCategoria(p.categoriaId)}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{pesos(p.precio)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      p.activo ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditando(p)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Editar"
                    >
                      <Icono nombre="editar" size={16} />
                    </button>
                    <button
                      onClick={() => setAEliminar(p)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
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
                  descripcion: editando.descripcion
                })
                setEditando(null)
                toast(esNuevo ? 'Producto creado' : 'Producto actualizado')
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Precio">
                <input
                  type="number"
                  value={editando.precio ?? 0}
                  onChange={(e) => setEditando({ ...editando, precio: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </Campo>
              <Campo label="Categoría">
                <select
                  value={editando.categoriaId ?? ''}
                  onChange={(e) =>
                    setEditando({ ...editando, categoriaId: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editando.activo ?? true}
                onChange={(e) => setEditando({ ...editando, activo: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Producto activo (visible en pedidos)
            </label>

            {editando.id != null ? (
              <ModificadoresEditor productoId={editando.id} />
            ) : (
              <p className="mt-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
                Guarda el producto para poder agregarle modificadores.
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
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Nueva categoría
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ordenadas.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <span className="font-semibold text-slate-800">{c.nombre}</span>
              <span className="ml-2 text-xs text-slate-400">
                {cuenta(c.id)} {cuenta(c.id) === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setEditando(c)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Editar"
              >
                <Icono nombre="editar" size={16} />
              </button>
              <button
                onClick={() => cuenta(c.id) === 0 && setAEliminar(c)}
                disabled={cuenta(c.id) > 0}
                title={cuenta(c.id) > 0 ? 'Mueve o elimina sus productos primero' : ''}
                className="rounded-md p-1.5 text-slate-400 enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-300"
                aria-label="Eliminar"
              >
                <Icono nombre="eliminar" size={16} />
              </button>
            </div>
          </div>
        ))}
        {ordenadas.length === 0 && (
          <p className="py-8 text-center text-slate-400">No hay categorías</p>
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
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
                  orden: Number(editando.orden) || 1
                })
                setEditando(null)
                toast(esNueva ? 'Categoría creada' : 'Categoría actualizada')
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </Campo>
            <Campo label="Orden">
              <input
                type="number"
                value={editando.orden ?? 1}
                onChange={(e) => setEditando({ ...editando, orden: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
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
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}
