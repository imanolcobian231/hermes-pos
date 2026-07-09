import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Categoria, Producto } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import {
  leerArchivo,
  sugerirMapeo,
  mapearFilas,
  type ArchivoProductos,
  type CampoProducto,
  type MapeoColumnas
} from '@renderer/lib/importar'
import { pesos, capitalizar } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'
import { AsignarGrupos } from '@renderer/components/AsignarGrupos'
import { GestorModificadores } from '@renderer/components/GestorModificadores'
import { COLORES } from '@renderer/lib/colores'

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
  const { productos, categorias, guardarProducto, eliminarProducto, importarProductos } = useDatos()
  const toast = useToast()
  const [editando, setEditando] = useState<Partial<Producto> | null>(null)
  const [aEliminar, setAEliminar] = useState<Producto | null>(null)
  const [archivo, setArchivo] = useState<ArchivoProductos | null>(null)
  const [mapeo, setMapeo] = useState<MapeoColumnas | null>(null)
  const [importando, setImportando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const vProd = useVirtualizer({
    count: productos.length,
    getScrollElement: () => listaRef.current,
    estimateSize: () => 46,
    overscan: 8
  })

  const nombreCategoria = (id: number): string => {
    const c = categorias.find((c) => c.id === id)
    return c ? capitalizar(c.nombre) : '—'
  }

  const nuevo = (): void =>
    setEditando({ nombre: '', precio: 0, categoriaId: categorias[0]?.id, activo: true })

  const elegirArchivo = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const arch = await leerArchivo(file)
      if (arch.filas.length === 0 || arch.columnas.length === 0) {
        toast('El archivo no tiene columnas/filas con datos', 'error')
        return
      }
      setArchivo(arch)
      setMapeo(sugerirMapeo(arch.columnas))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo leer el archivo', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Productos resultantes del mapeo actual (para la vista previa y la importación).
  const filasMapeadas = useMemo(
    () => (archivo && mapeo ? mapearFilas(archivo.filas, mapeo) : []),
    [archivo, mapeo]
  )
  const validos = filasMapeadas.filter((f) => f.nombre && f.categoria).length
  const mapeoListo = !!mapeo && !!mapeo.nombre && !!mapeo.categoria

  const cerrarImport = (): void => {
    setArchivo(null)
    setMapeo(null)
  }

  // Primer valor no vacío de una columna, para mostrarlo como ejemplo.
  const ejemplo = (col: string): string => {
    if (!archivo) return ''
    const fila = archivo.filas.find((r) => String(r[col] ?? '').trim() !== '')
    const v = String(fila?.[col] ?? '').trim()
    return v.length > 18 ? v.slice(0, 18) + '…' : v
  }

  const confirmarImport = async (): Promise<void> => {
    if (!mapeoListo || filasMapeadas.length === 0) return
    setImportando(true)
    try {
      const r = await importarProductos(filasMapeadas)
      cerrarImport()
      const extra = r.categoriasNuevas > 0 ? ` · ${r.categoriasNuevas} categoría(s) nueva(s)` : ''
      toast(`${r.creados} producto(s) importado(s)${extra}`, 'info')
      if (r.errores.length > 0) toast(`${r.errores.length} fila(s) con error`, 'error')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo importar', 'error')
    } finally {
      setImportando(false)
    }
  }

  const COLS = 'grid-cols-[2fr_1.4fr_0.8fr_0.9fr_0.9fr_64px]'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex shrink-0 justify-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => void elegirArchivo(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
        >
          Importar Excel/CSV
        </button>
        <button
          onClick={nuevo}
          disabled={categorias.length === 0}
          title={categorias.length === 0 ? 'Crea una categoría primero' : ''}
          className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/[0.06] bg-white">
        <div
          className={`grid ${COLS} shrink-0 items-center gap-2 border-b border-black/[0.06] bg-black/[0.03] px-4 py-2.5 text-xs uppercase text-tinta-suave`}
        >
          <span>Producto</span>
          <span>Categoría</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Stock</span>
          <span className="text-center">Estado</span>
          <span></span>
        </div>
        {productos.length === 0 ? (
          <p className="px-4 py-8 text-center text-tinta-suave">
            {categorias.length === 0
              ? 'Crea una categoría en la pestaña “Categorías” antes de agregar productos.'
              : 'No hay productos'}
          </p>
        ) : (
          <div ref={listaRef} className="min-h-0 flex-1 overflow-auto">
            <div style={{ height: vProd.getTotalSize(), position: 'relative', width: '100%' }}>
              {vProd.getVirtualItems().map((vr) => {
                const p = productos[vr.index]
                return (
                  <div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vr.start}px)`,
                      height: 46
                    }}
                    className={`grid ${COLS} items-center gap-2 border-b border-black/[0.04] px-4 text-sm`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {p.color && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                      <span className="min-w-0 truncate font-medium text-tinta">{p.nombre}</span>
                    </span>
                    <span className="min-w-0 truncate text-tinta-suave">
                      {nombreCategoria(p.categoriaId)}
                    </span>
                    <span className="text-right text-tinta">{pesos(p.precio)}</span>
                    <span className="text-right">
                      {p.controlarStock ? (
                        <span
                          className={`font-semibold ${
                            p.stock <= p.stockMinimo ? 'text-amber-600' : 'text-tinta'
                          }`}
                        >
                          {p.stock}
                          {p.stock <= p.stockMinimo && (
                            <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              bajo
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-tinta-suave/50">—</span>
                      )}
                    </span>
                    <span className="text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          p.activo ? 'bg-acento text-white' : 'bg-black/[0.05] text-tinta-suave'
                        }`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </span>
                    <span className="flex justify-end gap-1">
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
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
                  costo: Number(editando.costo) || 0,
                  color: editando.color
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
                      {capitalizar(c.nombre)}
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

            {/* Color del botón en pedidos (identificación rápida) */}
            <Campo label="Color en pedidos">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditando({ ...editando, color: undefined })}
                  title="Sin color"
                  className={`flex h-8 w-8 items-center justify-center rounded-full border bg-white text-xs text-tinta-suave ${
                    !editando.color ? 'border-acento ring-2 ring-acento/25' : 'border-black/15'
                  }`}
                >
                  ✕
                </button>
                {COLORES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setEditando({ ...editando, color: c })}
                    style={{ backgroundColor: c }}
                    className={`h-8 w-8 rounded-full border transition ${
                      editando.color === c ? 'border-acento ring-2 ring-acento/30' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </Campo>

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

      {/* Importar: mapeo de columnas + vista previa */}
      <Modal
        abierto={archivo !== null}
        titulo="Importar productos — relaciona las columnas"
        onCerrar={cerrarImport}
        pie={
          <>
            <button onClick={cerrarImport} className="btn-texto">
              Cancelar
            </button>
            <button
              onClick={() => void confirmarImport()}
              disabled={importando || !mapeoListo || validos === 0}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover disabled:opacity-50"
            >
              {importando ? 'Importando…' : `Importar ${validos}`}
            </button>
          </>
        }
      >
        {archivo && mapeo && (
          <div>
            <p className="mb-3 text-sm text-tinta-suave">
              Elige qué columna del archivo corresponde a cada dato. <strong>Nombre</strong> y{' '}
              <strong>Categoría</strong> son obligatorios.
            </p>

            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              {(
                [
                  ['nombre', 'Nombre', true],
                  ['categoria', 'Categoría', true],
                  ['precio', 'Precio', false],
                  ['costo', 'Costo', false],
                  ['stock', 'Stock', false],
                  ['stockMinimo', 'Stock mínimo', false],
                  ['controlarStock', 'Controlar inventario', false]
                ] as [CampoProducto, string, boolean][]
              ).map(([campo, label, obligatorio]) => {
                const col = mapeo[campo]
                return (
                  <div
                    key={campo}
                    className="flex items-center gap-3 border-b border-black/[0.05] px-3 py-2 last:border-0 odd:bg-black/[0.015]"
                  >
                    <div className="w-36 shrink-0 text-sm">
                      <span className="font-medium text-tinta">{label}</span>
                      {obligatorio && <span className="ml-0.5 text-red-500">*</span>}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <select
                        value={col ?? ''}
                        onChange={(e) => setMapeo({ ...mapeo, [campo]: e.target.value || null })}
                        className={`min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm outline-none focus:border-acento ${
                          obligatorio && !col ? 'border-amber-300 bg-amber-50' : 'border-black/10'
                        }`}
                      >
                        <option value="">— Ninguna —</option>
                        {archivo.columnas.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <span className="w-28 shrink-0 truncate text-xs text-tinta-suave">
                        {col ? (ejemplo(col) ? `ej: ${ejemplo(col)}` : 'vacío') : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
              Vista previa ({validos} válidos de {filasMapeadas.length})
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-black/[0.06]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filasMapeadas.slice(0, 50).map((f, i) => (
                    <tr key={i} className="border-t border-black/[0.04]">
                      <td className="px-3 py-1.5 text-tinta">
                        {f.nombre || <span className="text-red-600">(sin nombre)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{pesos(f.precio || 0)}</td>
                      <td className="px-3 py-1.5 text-tinta-suave">
                        {f.categoria || <span className="text-red-600">(falta)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-tinta-suave">{pesos(f.costo || 0)}</td>
                      <td className="px-3 py-1.5 text-right text-tinta-suave">
                        {f.controlarStock ? f.stock ?? 0 : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filasMapeadas.length > 50 && (
              <p className="mt-1 text-xs text-tinta-suave">… y {filasMapeadas.length - 50} más.</p>
            )}
            {!mapeoListo && (
              <p className="mt-2 text-xs font-medium text-amber-600">
                Relaciona al menos Nombre y Categoría para poder importar.
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
              <span className="font-semibold text-tinta">{capitalizar(c.nombre)}</span>
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
