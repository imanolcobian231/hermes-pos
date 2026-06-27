import { useEffect, useMemo, useState } from 'react'
import type { Insumo, InsumoInput, MovimientoInventario, TipoMovInventario } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { useAuth } from '@renderer/store/auth'
import { pesos, fechaHora } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toast'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

const UNIDADES = ['pieza', 'kg', 'g', 'litro', 'ml', 'paquete', 'caja', 'bolsa']

const MOVS: { id: TipoMovInventario; label: string; icono: NombreIcono; ayuda: string }[] = [
  { id: 'entrada', label: 'Entrada', icono: 'mas', ayuda: 'Cantidad que entra' },
  { id: 'salida', label: 'Salida', icono: 'recibo', ayuda: 'Cantidad que sale' },
  { id: 'merma', label: 'Merma', icono: 'alerta', ayuda: 'Cantidad desperdiciada' },
  { id: 'ajuste', label: 'Ajuste', icono: 'editar', ayuda: 'Stock real contado' }
]

const etiquetaMov: Record<TipoMovInventario, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  merma: 'Merma',
  ajuste: 'Ajuste'
}

export function Inventario(): React.JSX.Element {
  const { insumos, guardarInsumo, eliminarInsumo, movimientoInventario } = useDatos()
  const toast = useToast()
  const [form, setForm] = useState<InsumoInput | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)

  const detalle = insumos.find((i) => i.id === detalleId) ?? null

  const resumen = useMemo(() => {
    const bajo = insumos.filter((i) => i.stock <= i.stockMinimo).length
    const valor = insumos.reduce((s, i) => s + i.stock * i.costo, 0)
    return { num: insumos.length, bajo, valor }
  }, [insumos])

  const guardar = async (): Promise<void> => {
    if (!form) return
    if (!form.nombre.trim()) {
      toast('El nombre es obligatorio', 'error')
      return
    }
    try {
      await guardarInsumo(form)
      setForm(null)
      toast('Insumo guardado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-tinta">Inventario</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {resumen.num} {resumen.num === 1 ? 'insumo' : 'insumos'} ·{' '}
            <span className={resumen.bajo > 0 ? 'font-semibold text-amber-600' : ''}>
              {resumen.bajo} bajo stock
            </span>{' '}
            · valor <strong className="text-tinta">{pesos(resumen.valor)}</strong>
          </p>
        </div>
        <button
          onClick={() => setForm({ nombre: '', unidad: 'pieza', stockMinimo: 0, costo: 0 })}
          className="btn-primario"
        >
          <Icono nombre="mas" size={16} />
          Nuevo insumo
        </button>
      </header>

      {insumos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
          <Icono nombre="inventario" size={40} className="text-tinta-suave/40" />
          <p className="mt-3 font-semibold">Sin insumos registrados</p>
        </div>
      ) : (
        <div className="tarjeta overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-black/[0.06] bg-black/[0.02] text-left text-xs uppercase tracking-wider text-tinta-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Insumo</th>
                <th className="px-4 py-3 text-right font-semibold">Stock</th>
                <th className="px-4 py-3 text-right font-semibold">Mínimo</th>
                <th className="px-4 py-3 text-right font-semibold">Costo</th>
                <th className="px-4 py-3 text-right font-semibold">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => {
                const bajo = i.stock <= i.stockMinimo
                return (
                  <tr
                    key={i.id}
                    onClick={() => setDetalleId(i.id)}
                    className="cursor-pointer border-b border-black/[0.04] transition last:border-0 hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium text-tinta">{i.nombre}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${bajo ? 'text-amber-600' : 'text-tinta'}`}>
                        {i.stock} {i.unidad}
                      </span>
                      {bajo && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          bajo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta-suave">
                      {i.stockMinimo} {i.unidad}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta-suave">{pesos(i.costo)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-tinta">
                      {pesos(i.stock * i.costo)}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta-suave">
                      <Icono nombre="volver" size={14} className="inline rotate-180" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alta / edición */}
      <Modal
        abierto={form !== null}
        titulo={form?.id ? 'Editar insumo' : 'Nuevo insumo'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button onClick={() => setForm(null)} className="btn-texto">
              Cancelar
            </button>
            <button onClick={() => void guardar()} className="btn-primario">
              Guardar
            </button>
          </>
        }
      >
        {form && (
          <div className="flex flex-col gap-3">
            <Campo
              label="Nombre"
              valor={form.nombre}
              onChange={(v) => setForm({ ...form, nombre: v })}
              placeholder="Ej. Carne al pastor"
              autoFocus
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta-suave">Unidad</label>
              <input
                list="unidades-insumo"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                className="campo"
              />
              <datalist id="unidades-insumo">
                {UNIDADES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CampoNum
                label="Stock mínimo"
                valor={form.stockMinimo}
                onChange={(n) => setForm({ ...form, stockMinimo: n })}
              />
              <CampoNum
                label="Costo por unidad"
                prefijo="$"
                valor={form.costo}
                onChange={(n) => setForm({ ...form, costo: n })}
              />
            </div>
            {!form.id && (
              <p className="text-xs text-tinta-suave/80">
                El stock inicial se captura como una “Entrada” desde el detalle del insumo.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Detalle del insumo */}
      <DetalleInsumo
        insumo={detalle}
        onCerrar={() => setDetalleId(null)}
        onEditar={(i) => {
          setDetalleId(null)
          setForm({ id: i.id, nombre: i.nombre, unidad: i.unidad, stockMinimo: i.stockMinimo, costo: i.costo })
        }}
        onEliminar={async (i) => {
          await eliminarInsumo(i.id)
          setDetalleId(null)
          toast('Insumo eliminado', 'info')
        }}
        onMover={movimientoInventario}
      />
    </div>
  )
}

function DetalleInsumo({
  insumo,
  onCerrar,
  onEditar,
  onEliminar,
  onMover
}: {
  insumo: Insumo | null
  onCerrar: () => void
  onEditar: (i: Insumo) => void
  onEliminar: (i: Insumo) => Promise<void>
  onMover: (
    insumoId: number,
    tipo: TipoMovInventario,
    cantidad: number,
    nota?: string,
    usuario?: string
  ) => Promise<void>
}): React.JSX.Element | null {
  const { usuarioActual } = useAuth()
  const toast = useToast()
  const [movs, setMovs] = useState<MovimientoInventario[]>([])
  const [tipo, setTipo] = useState<TipoMovInventario>('entrada')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')

  useEffect(() => {
    if (!insumo) return
    void window.api.inventario.movimientos(insumo.id).then(setMovs)
    setTipo('entrada')
    setCantidad('')
    setNota('')
  }, [insumo?.id, insumo?.stock])

  if (!insumo) return null

  const cant = parseFloat(cantidad) || 0
  const ayuda = MOVS.find((m) => m.id === tipo)!.ayuda
  const bajo = insumo.stock <= insumo.stockMinimo

  const registrar = async (): Promise<void> => {
    if (cant <= 0 && tipo !== 'ajuste') {
      toast('Captura una cantidad', 'error')
      return
    }
    try {
      await onMover(insumo.id, tipo, cant, nota, usuarioActual?.nombre)
      setCantidad('')
      setNota('')
      toast('Movimiento registrado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar', 'error')
    }
  }

  return (
    <Modal
      abierto={insumo !== null}
      titulo={insumo.nombre}
      onCerrar={onCerrar}
      pie={
        <>
          <button
            onClick={() => void onEliminar(insumo)}
            className="mr-auto rounded-full px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
          <button onClick={() => onEditar(insumo)} className="btn-neutro">
            Editar
          </button>
          <button onClick={onCerrar} className="btn-primario">
            Listo
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3">
        <span className="text-sm font-medium text-tinta-suave">Stock actual</span>
        <span className={`text-xl font-semibold ${bajo ? 'text-amber-600' : 'text-tinta'}`}>
          {insumo.stock} {insumo.unidad}
        </span>
      </div>

      {/* Registrar movimiento */}
      <div className="mb-4 rounded-2xl border border-black/[0.06] p-3">
        <div className="mb-2 grid grid-cols-4 gap-2">
          {MOVS.map((m) => (
            <button
              key={m.id}
              onClick={() => setTipo(m.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-semibold transition ${
                tipo === m.id
                  ? 'border-acento bg-acento text-white'
                  : 'border-black/[0.08] text-tinta-suave hover:bg-black/[0.04]'
              }`}
            >
              <Icono nombre={m.icono} size={15} />
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={`${ayuda} (${insumo.unidad})`}
            className="campo flex-1"
          />
        </div>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="campo mt-2"
        />
        <button onClick={() => void registrar()} className="btn-primario mt-3 w-full">
          Registrar {etiquetaMov[tipo].toLowerCase()}
        </button>
      </div>

      {/* Historial */}
      <div className="text-sm font-semibold text-tinta">Movimientos</div>
      {movs.length === 0 ? (
        <p className="py-2 text-sm text-tinta-suave">Sin movimientos.</p>
      ) : (
        <div className="mt-1 max-h-48 overflow-auto">
          {movs.map((m) => {
            const signo = m.tipo === 'entrada' ? '+' : m.tipo === 'ajuste' ? '=' : '−'
            const color =
              m.tipo === 'entrada'
                ? 'text-emerald-600'
                : m.tipo === 'ajuste'
                  ? 'text-tinta'
                  : 'text-red-600'
            return (
              <div
                key={m.id}
                className="flex items-center justify-between border-b border-black/[0.04] py-1.5 text-sm last:border-0"
              >
                <div>
                  <span className={`font-semibold ${color}`}>{etiquetaMov[m.tipo]}</span>
                  <span className="ml-2 text-xs text-tinta-suave">{fechaHora(m.creadoEn)}</span>
                  {m.nota && <span className="ml-2 text-xs text-tinta-suave">· {m.nota}</span>}
                </div>
                <span className={`font-semibold ${color}`}>
                  {signo}
                  {m.cantidad} {insumo.unidad}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  autoFocus
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-tinta-suave">{label}</label>
      <input
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="campo"
      />
    </div>
  )
}

function CampoNum({
  label,
  valor,
  onChange,
  prefijo
}: {
  label: string
  valor: number
  onChange: (n: number) => void
  prefijo?: string
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-tinta-suave">{label}</label>
      <div className="flex items-center gap-1">
        {prefijo && <span className="text-sm text-tinta-suave">{prefijo}</span>}
        <input
          type="number"
          min={0}
          value={valor || ''}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          placeholder="0"
          className="campo"
        />
      </div>
    </div>
  )
}
