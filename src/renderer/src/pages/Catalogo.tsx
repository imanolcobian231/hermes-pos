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
import { EncabezadoPagina, EstadoVacio, Pestanas } from '@renderer/components/Pagina'
import { Select } from '@renderer/components/Select'
import { COLORES } from '@renderer/lib/colores'

type Pestana = 'productos' | 'categorias' | 'modificadores'

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'productos', label: 'Productos' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'modificadores', label: 'Modificadores' }
]

type FiltroTipo = 'todos' | 'producto' | 'combo'

const FILTROS: { id: FiltroTipo; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'producto', label: 'Productos' },
  { id: 'combo', label: 'Combos' }
]


export function Catalogo(): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>('productos')

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Catálogo"
        subtitulo="Administra productos, categorías y modificadores"
      />

      <Pestanas
        className="mb-5 w-full max-w-md"
        opciones={PESTANAS}
        valor={pestana}
        onChange={setPestana}
      />

      {pestana === 'productos' && <PanelProductos />}
      {pestana === 'categorias' && <PanelCategorias />}
      {pestana === 'modificadores' && <GestorModificadores />}
    </div>
  )
}

// --- Productos --------------------------------------------------------------

function PanelProductos(): React.JSX.Element {
  const { productos, categorias, insumos, guardarProducto, eliminarProducto, importarProductos } =
    useDatos()
  const toast = useToast()
  const [editando, setEditando] = useState<Partial<Producto> | null>(null)
  const [aEliminar, setAEliminar] = useState<Producto | null>(null)
  const [archivo, setArchivo] = useState<ArchivoProductos | null>(null)
  const [mapeo, setMapeo] = useState<MapeoColumnas | null>(null)
  const [importando, setImportando] = useState(false)
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')
  const fileRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  // El filtro de tipo solo se ofrece si hay combos (si no, no aporta nada).
  const hayCombos = useMemo(() => productos.some((p) => p.esCombo), [productos])
  const productosFiltrados = useMemo(
    () =>
      productos.filter(
        (p) => filtro === 'todos' || (filtro === 'combo' ? p.esCombo : !p.esCombo)
      ),
    [productos, filtro]
  )
  const vProd = useVirtualizer({
    count: productosFiltrados.length,
    getScrollElement: () => listaRef.current,
    estimateSize: () => 64,
    overscan: 8
  })

  const nombreCategoria = (id: number): string => {
    const c = categorias.find((c) => c.id === id)
    return c ? capitalizar(c.nombre) : '—'
  }

  const nuevo = (): void =>
    setEditando({ nombre: '', precio: 0, categoriaId: categorias[0]?.id, activo: true, esCombo: false, comboItems: [], receta: [] })

  // Al editar carga las partes del combo (si aplica) y la receta de insumos.
  const editar = async (p: Producto): Promise<void> => {
    const items = p.esCombo ? await window.api.catalogo.comboItems(p.id) : []
    const receta = await window.api.catalogo.receta(p.id)
    setEditando({ ...p, comboItems: items, receta })
  }

  // Insumos disponibles para la receta (para el selector).
  const insumosParaReceta = insumos.map((i) => ({ valor: i.id, label: `${i.nombre} (${i.unidad})` }))
  const setRecetaItem = (i: number, patch: { insumoId?: number; cantidad?: number }): void =>
    setEditando((e) => {
      const items = [...(e?.receta ?? [])]
      items[i] = { ...items[i], ...patch }
      return { ...e, receta: items }
    })
  const agregarRecetaItem = (): void =>
    setEditando((e) => ({
      ...e,
      receta: [...(e?.receta ?? []), { insumoId: insumos[0]?.id ?? 0, cantidad: 1 }]
    }))
  const quitarRecetaItem = (i: number): void =>
    setEditando((e) => ({ ...e, receta: (e?.receta ?? []).filter((_, j) => j !== i) }))

  // Productos que pueden ir dentro de un combo (no combos, no el que se edita).
  const productosParaCombo = productos
    .filter((p) => !p.esCombo && p.id !== editando?.id)
    .map((p) => ({ valor: p.id, label: capitalizar(p.nombre) }))

  const setComboItem = (i: number, patch: { productoId?: number; cantidad?: number }): void =>
    setEditando((e) => {
      const items = [...(e?.comboItems ?? [])]
      items[i] = { ...items[i], ...patch }
      return { ...e, comboItems: items }
    })
  const agregarComboItem = (): void =>
    setEditando((e) => ({
      ...e,
      comboItems: [
        ...(e?.comboItems ?? []),
        { productoId: productos.find((p) => !p.esCombo)?.id ?? 0, cantidad: 1 }
      ]
    }))
  const quitarComboItem = (i: number): void =>
    setEditando((e) => ({ ...e, comboItems: (e?.comboItems ?? []).filter((_, j) => j !== i) }))

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
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => void elegirArchivo(e.target.files?.[0])}
        />
        <div className="flex items-center gap-3">
          <div className="text-sm text-tinta-suave">
            <span className="font-semibold text-tinta">{productosFiltrados.length}</span>{' '}
            {productosFiltrados.length === 1 ? 'producto' : 'productos'}
            {productosFiltrados.length > 0 && (
              <> · {productosFiltrados.filter((p) => p.activo).length} activos</>
            )}
          </div>
          {hayCombos && (
            <Pestanas
              className="w-72"
              opciones={FILTROS}
              valor={filtro}
              onChange={setFiltro}
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-neutro"
          >
            <Icono nombre="catalogo" size={15} />
            Importar Excel/CSV
          </button>
          <button
            onClick={nuevo}
            disabled={categorias.length === 0}
            title={categorias.length === 0 ? 'Crea una categoría primero' : ''}
            className="btn-primario disabled:bg-black/10 disabled:text-tinta-suave/50"
          >
            <Icono nombre="mas" size={16} />
            Nuevo producto
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <div
          className={`grid ${COLS} shrink-0 items-center gap-2 border-b border-black/[0.06] bg-black/[0.02] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-tinta-suave`}
        >
          <span>Producto</span>
          <span>Categoría</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Stock</span>
          <span className="text-center">Estado</span>
          <span></span>
        </div>
        {productosFiltrados.length === 0 ? (
          <EstadoVacio
            icono="catalogo"
            titulo={
              productos.length > 0
                ? filtro === 'combo'
                  ? 'No hay combos'
                  : 'No hay productos individuales'
                : categorias.length === 0
                  ? 'Aún no hay productos'
                  : 'No hay productos'
            }
            descripcion={
              productos.length > 0
                ? 'Cambia el filtro para ver otros productos.'
                : categorias.length === 0
                  ? 'Crea una categoría en la pestaña “Categorías” antes de agregar productos.'
                  : 'Agrega tu primer producto con el botón de arriba.'
            }
          />
        ) : (
          <div ref={listaRef} className="min-h-0 flex-1 overflow-auto">
            <div style={{ height: vProd.getTotalSize(), position: 'relative', width: '100%' }}>
              {vProd.getVirtualItems().map((vr) => {
                const p = productosFiltrados[vr.index]
                return (
                  <div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vr.start}px)`,
                      height: 64
                    }}
                    className={`group grid ${COLS} items-center gap-2 border-b border-black/[0.04] px-4 text-sm transition hover:bg-black/[0.02]`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: p.color ?? 'transparent' }}
                      />
                      <span className="min-w-0 truncate text-[15px] font-semibold text-tinta">
                        {p.nombre}
                      </span>
                      {p.esCombo && (
                        <span className="shrink-0 rounded bg-acento/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-acento">
                          Combo
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 truncate text-tinta-suave">
                      {nombreCategoria(p.categoriaId)}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-tinta">
                      {pesos(p.precio)}
                    </span>
                    <span className="text-right">
                      {p.controlarStock ? (
                        <span
                          className={`font-semibold ${
                            p.stock <= 0
                              ? 'text-red-600'
                              : p.stock <= p.stockMinimo
                                ? 'text-amber-600'
                                : 'text-tinta'
                          }`}
                        >
                          {p.stock}
                          {p.stock <= 0 ? (
                            <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                              agotado
                            </span>
                          ) : (
                            p.stock <= p.stockMinimo && (
                              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                                bajo
                              </span>
                            )
                          )}
                        </span>
                      ) : (
                        <span className="text-tinta-suave/50">—</span>
                      )}
                    </span>
                    <Select<'activo' | 'inactivo'>
                      className="justify-self-center"
                      size="sm"
                      valor={p.activo ? 'activo' : 'inactivo'}
                      onChange={(v) => void guardarProducto({ ...p, activo: v === 'activo' })}
                      opciones={[
                        { valor: 'activo', label: 'Activo' },
                        { valor: 'inactivo', label: 'Inactivo' }
                      ]}
                    />
                    <span className="flex justify-end gap-1">
                      <button
                        onClick={() => void editar(p)}
                        className="rounded-lg p-1.5 text-tinta-suave transition hover:bg-black/[0.05] hover:text-tinta"
                        aria-label="Editar"
                      >
                        <Icono nombre="editar" size={16} />
                      </button>
                      <button
                        onClick={() => setAEliminar(p)}
                        className="rounded-lg p-1.5 text-tinta-suave transition hover:bg-red-50 hover:text-red-600"
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
              className="btn-texto"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!editando?.nombre?.trim() || editando.categoriaId == null) return
                const esNuevo = editando.id == null
                const controlarStock = editando.controlarStock ?? false
                const stock = Math.max(0, Number(editando.stock) || 0)
                const stockMinimo = Math.max(0, Number(editando.stockMinimo) || 0)
                guardarProducto({
                  id: editando.id,
                  nombre: editando.nombre.trim(),
                  precio: Number(editando.precio) || 0,
                  categoriaId: editando.categoriaId,
                  activo: editando.activo ?? true,
                  descripcion: editando.descripcion,
                  controlarStock,
                  stock,
                  stockMinimo,
                  costo: Number(editando.costo) || 0,
                  color: editando.color,
                  codigoBarras: editando.codigoBarras?.trim() || undefined,
                  esCombo: editando.esCombo ?? false,
                  comboItems: (editando.comboItems ?? []).filter((it) => it.productoId),
                  receta: (editando.receta ?? []).filter((it) => it.insumoId && it.cantidad > 0)
                })
                setEditando(null)
                toast(esNuevo ? 'Producto creado' : 'Producto actualizado')
                if (controlarStock && stock <= 0) toast(`${editando.nombre}: sin stock`, 'error')
                else if (controlarStock && stock <= stockMinimo)
                  toast(`${editando.nombre}: stock bajo`, 'advertencia')
              }}
              className="btn-primario"
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
                maxLength={40}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              />
            </Campo>
            <Campo label="Código de barras">
              <input
                value={editando.codigoBarras ?? ''}
                placeholder="Escanéalo aquí o escríbelo (largo libre, opcional)"
                onChange={(e) => setEditando({ ...editando, codigoBarras: e.target.value })}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
              />
            </Campo>
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Precio">
                <input
                  type="number"
                  value={editando.precio || ''}
                  onChange={(e) => setEditando({ ...editando, precio: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                />
              </Campo>
              <Campo label="Costo">
                <input
                  type="number"
                  value={editando.costo || ''}
                  onChange={(e) => setEditando({ ...editando, costo: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                />
              </Campo>
              <Campo label="Categoría">
                <Select<number>
                  valor={editando.categoriaId ?? 0}
                  onChange={(categoriaId) => setEditando({ ...editando, categoriaId })}
                  opciones={categorias.map((c) => ({ valor: c.id, label: capitalizar(c.nombre) }))}
                  placeholder="Elegir categoría"
                />
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
                        min={0}
                        value={editando.stock || ''}
                        onChange={(e) =>
                          setEditando({ ...editando, stock: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                      />
                    </Campo>
                    <Campo label="Stock mínimo">
                      <input
                        type="number"
                        min={0}
                        value={editando.stockMinimo || ''}
                        onChange={(e) =>
                          setEditando({ ...editando, stockMinimo: Math.max(0, Number(e.target.value) || 0) })
                        }
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

            {/* Combo: precio fijo que incluye varios productos */}
            <div className="rounded-xl border border-black/[0.06] p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-tinta">
                <input
                  type="checkbox"
                  checked={editando.esCombo ?? false}
                  onChange={(e) => setEditando({ ...editando, esCombo: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Es un combo (precio fijo con varios productos)
              </label>
              {editando.esCombo && (
                <div className="mt-3 space-y-2">
                  {(editando.comboItems ?? []).length === 0 && (
                    <p className="text-xs text-tinta-suave">
                      Agrega los productos que incluye el combo.
                    </p>
                  )}
                  {(editando.comboItems ?? []).map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select<number>
                        className="min-w-0 flex-1"
                        size="sm"
                        valor={it.productoId}
                        onChange={(v) => setComboItem(i, { productoId: v })}
                        opciones={productosParaCombo}
                        placeholder="Producto"
                      />
                      <div className="flex items-center rounded-lg border border-black/10 px-2">
                        <span className="text-xs text-tinta-suave">×</span>
                        <input
                          type="number"
                          min={1}
                          value={it.cantidad}
                          onChange={(e) =>
                            setComboItem(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })
                          }
                          className="w-12 bg-transparent py-1.5 pl-1 text-right text-sm outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarComboItem(i)}
                        className="rounded-lg p-1.5 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                        aria-label="Quitar"
                      >
                        <Icono nombre="eliminar" size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarComboItem}
                    disabled={productosParaCombo.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-1.5 text-sm font-semibold text-tinta-suave transition-colors hover:border-acento/40 hover:text-acento disabled:opacity-40"
                  >
                    <Icono nombre="mas" size={15} /> Agregar producto
                  </button>
                  <p className="text-[11px] text-tinta-suave/80">
                    El combo se vende como un solo producto al precio de arriba.
                  </p>
                </div>
              )}
            </div>

            {/* Receta: insumos que consume el producto al venderse (descuenta stock). */}
            <div className="rounded-xl border border-black/[0.06] p-3">
              <div className="text-sm font-medium text-tinta">Insumos que consume (receta)</div>
              {insumos.length === 0 ? (
                <p className="mt-2 text-xs text-tinta-suave">
                  Crea insumos en Inventario para armar la receta.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {(editando.receta ?? []).length === 0 && (
                    <p className="text-xs text-tinta-suave">
                      Agrega los insumos que gasta cada unidad de este producto.
                    </p>
                  )}
                  {(editando.receta ?? []).map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select<number>
                        className="min-w-0 flex-1"
                        size="sm"
                        valor={it.insumoId}
                        onChange={(v) => setRecetaItem(i, { insumoId: v })}
                        opciones={insumosParaReceta}
                        placeholder="Insumo"
                      />
                      <div className="flex items-center rounded-lg border border-black/10 px-2">
                        <span className="text-xs text-tinta-suave">×</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={it.cantidad}
                          onChange={(e) =>
                            setRecetaItem(i, { cantidad: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="w-16 bg-transparent py-1.5 pl-1 text-right text-sm outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarRecetaItem(i)}
                        className="rounded-lg p-1.5 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                        aria-label="Quitar"
                      >
                        <Icono nombre="eliminar" size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarRecetaItem}
                    className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-1.5 text-sm font-semibold text-tinta-suave transition-colors hover:border-acento/40 hover:text-acento"
                  >
                    <Icono nombre="mas" size={15} /> Agregar insumo
                  </button>
                  <p className="text-[11px] text-tinta-suave/80">
                    Al vender, se descuenta del inventario la cantidad × unidades vendidas.
                  </p>
                </div>
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
              className="btn-primario disabled:opacity-50"
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
                  ['codigoBarras', 'Código de barras', false],
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
                      <Select
                        size="sm"
                        className="min-w-0 flex-1"
                        invalido={obligatorio && !col}
                        valor={col ?? ''}
                        onChange={(v) => setMapeo({ ...mapeo, [campo]: v || null })}
                        opciones={[
                          { valor: '', label: '— Ninguna —' },
                          ...archivo.columnas.map((c) => ({ valor: c, label: c }))
                        ]}
                      />
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
          className="btn-primario"
        >
          <Icono nombre="mas" size={16} />
          Nueva categoría
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ordenadas.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm"
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
          <EstadoVacio
            icono="catalogo"
            titulo="No hay categorías"
            descripcion="Crea una categoría para empezar a organizar tus productos."
          />
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
              className="btn-texto"
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
              className="btn-primario"
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
                maxLength={40}
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
              <Select<'cocina' | 'barra'>
                valor={editando.rol === 'barra' ? 'barra' : 'cocina'}
                onChange={(rol) => setEditando({ ...editando, rol })}
                opciones={[
                  { valor: 'cocina', label: 'Cocina' },
                  { valor: 'barra', label: 'Barra' }
                ]}
              />
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
