import { useEffect, useState } from 'react'
import type { Cliente, ClienteInput, MetodoPago, MovimientoCredito } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos, fechaHora } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toast'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

const METODOS: { id: MetodoPago; label: string; icono: NombreIcono }[] = [
  { id: 'efectivo', label: 'Efectivo', icono: 'efectivo' },
  { id: 'tarjeta', label: 'Tarjeta', icono: 'tarjeta' },
  { id: 'transferencia', label: 'Transferencia', icono: 'transferencia' }
]

export function Clientes(): React.JSX.Element {
  const { clientes, guardarCliente, eliminarCliente, abonarCredito } = useDatos()
  const toast = useToast()
  const [form, setForm] = useState<ClienteInput | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)

  const detalle = clientes.find((c) => c.id === detalleId) ?? null
  const totalPorCobrar = clientes.reduce((s, c) => s + Math.max(0, c.saldo), 0)

  const guardar = async (): Promise<void> => {
    if (!form) return
    if (!form.nombre.trim()) {
      toast('El nombre es obligatorio', 'error')
      return
    }
    try {
      await guardarCliente(form)
      setForm(null)
      toast('Cliente guardado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tinta">Clientes</h1>
          <p className="text-sm text-tinta-suave">
            Cuentas de crédito (fiados) · por cobrar <strong>{pesos(totalPorCobrar)}</strong>
          </p>
        </div>
        <button
          onClick={() => setForm({ nombre: '', telefono: '', nota: '' })}
          className="flex items-center gap-2 rounded-lg bg-acento px-4 py-2.5 font-semibold text-white hover:bg-acento-hover"
        >
          <Icono nombre="mas" size={16} />
          Nuevo cliente
        </button>
      </header>

      {clientes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
          <Icono nombre="usuarios" size={40} className="text-tinta-suave/60" />
          <p className="mt-3 font-semibold">No hay clientes con crédito</p>
        </div>
      ) : (
        <div className="grid gap-3 overflow-auto pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => setDetalleId(c.id)}
              className="flex flex-col rounded-xl border border-black/[0.06] bg-white p-4 text-left hover:border-black/20"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-tinta">{c.nombre}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    c.saldo > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {c.saldo > 0 ? `Debe ${pesos(c.saldo)}` : 'Al corriente'}
                </span>
              </div>
              {c.telefono && <span className="mt-1 text-xs text-tinta-suave">{c.telefono}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Alta / edición */}
      <Modal
        abierto={form !== null}
        titulo={form?.id ? 'Editar cliente' : 'Nuevo cliente'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button
              onClick={() => setForm(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => void guardar()}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
            >
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
              placeholder="Ej. Don Beto"
              autoFocus
            />
            <Campo
              label="Teléfono (opcional)"
              valor={form.telefono ?? ''}
              onChange={(v) => setForm({ ...form, telefono: v })}
              placeholder="Ej. 55 1234 5678"
            />
            <Campo
              label="Nota (opcional)"
              valor={form.nota ?? ''}
              onChange={(v) => setForm({ ...form, nota: v })}
              placeholder="Ej. vecino de la esquina"
            />
          </div>
        )}
      </Modal>

      {/* Detalle del cliente */}
      <DetalleCliente
        cliente={detalle}
        onCerrar={() => setDetalleId(null)}
        onEditar={(c) => {
          setDetalleId(null)
          setForm({ id: c.id, nombre: c.nombre, telefono: c.telefono, nota: c.nota })
        }}
        onEliminar={async (c) => {
          try {
            await eliminarCliente(c.id)
            setDetalleId(null)
            toast('Cliente eliminado', 'info')
          } catch (e) {
            toast(e instanceof Error ? e.message : 'No se pudo eliminar', 'error')
          }
        }}
        onAbonar={async (c, monto, metodo, nota) => {
          try {
            await abonarCredito(c.id, monto, metodo, nota)
            toast('Abono registrado', 'info')
          } catch (e) {
            toast(e instanceof Error ? e.message : 'No se pudo abonar', 'error')
          }
        }}
      />
    </div>
  )
}

function DetalleCliente({
  cliente,
  onCerrar,
  onEditar,
  onEliminar,
  onAbonar
}: {
  cliente: Cliente | null
  onCerrar: () => void
  onEditar: (c: Cliente) => void
  onEliminar: (c: Cliente) => void
  onAbonar: (c: Cliente, monto: number, metodo: MetodoPago, nota?: string) => Promise<void>
}): React.JSX.Element | null {
  const [movs, setMovs] = useState<MovimientoCredito[]>([])
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')

  // Recarga los movimientos cuando cambia el cliente o su saldo (tras abonar).
  useEffect(() => {
    if (!cliente) return
    void window.api.clientes.movimientos(cliente.id).then(setMovs)
    setMonto('')
    setMetodo('efectivo')
  }, [cliente?.id, cliente?.saldo])

  if (!cliente) return null

  const montoNum = parseFloat(monto) || 0

  const abonar = async (): Promise<void> => {
    if (montoNum <= 0) return
    await onAbonar(cliente, montoNum, metodo)
  }

  return (
    <Modal
      abierto={cliente !== null}
      titulo={cliente.nombre}
      onCerrar={onCerrar}
      pie={
        <>
          <button
            onClick={() => onEliminar(cliente)}
            className="mr-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
          <button
            onClick={() => onEditar(cliente)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Editar
          </button>
          <button
            onClick={onCerrar}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
          >
            Listo
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between rounded-lg bg-black/[0.03] px-4 py-3">
        <span className="text-sm font-medium text-tinta-suave">Saldo</span>
        <span className={`text-xl font-bold ${cliente.saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {cliente.saldo > 0 ? pesos(cliente.saldo) : 'Al corriente'}
        </span>
      </div>

      {/* Abonar */}
      <div className="mb-4 rounded-lg border border-black/[0.06] p-3">
        <div className="mb-2 text-sm font-semibold text-tinta">Registrar abono</div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm text-tinta-suave">$</span>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="flex-1 rounded-md border border-black/10 px-2 py-1.5 text-right text-sm outline-none focus:border-acento"
          />
          {cliente.saldo > 0 && (
            <button
              onClick={() => setMonto(String(cliente.saldo))}
              className="rounded-md border border-black/[0.06] px-2 py-1 text-xs font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Saldar
            </button>
          )}
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetodo(m.id)}
              className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-semibold ${
                metodo === m.id
                  ? 'border-acento bg-acento text-white'
                  : 'border-black/[0.06] text-tinta-suave hover:border-black/20'
              }`}
            >
              <Icono nombre={m.icono} size={14} />
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void abonar()}
          disabled={montoNum <= 0}
          className="w-full rounded-md bg-acento py-2 text-sm font-bold text-white hover:bg-acento-hover disabled:bg-black/10 disabled:text-tinta-suave/50"
        >
          Abonar {montoNum > 0 ? pesos(montoNum) : ''}
        </button>
      </div>

      {/* Movimientos */}
      <div className="text-sm font-semibold text-tinta">Movimientos</div>
      {movs.length === 0 ? (
        <p className="py-2 text-sm text-tinta-suave">Sin movimientos.</p>
      ) : (
        <div className="mt-1 max-h-52 overflow-auto">
          {movs.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-black/[0.04] py-1.5 text-sm last:border-0">
              <div>
                <span className={`font-semibold ${m.tipo === 'cargo' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {m.tipo === 'cargo' ? 'Cargo' : 'Abono'}
                </span>
                <span className="ml-2 text-xs text-tinta-suave">{fechaHora(m.creadoEn)}</span>
                {m.metodo && <span className="ml-2 text-xs text-tinta-suave">· {m.metodo}</span>}
              </div>
              <span className={m.tipo === 'cargo' ? 'text-red-600' : 'text-emerald-600'}>
                {m.tipo === 'cargo' ? '+' : '−'}
                {pesos(m.monto)}
              </span>
            </div>
          ))}
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
        className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
      />
    </div>
  )
}
