import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mesa, OrdenConDetalle } from '@shared/types'
import { TarjetaMesa } from '@renderer/components/TarjetaMesa'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'

interface Props {
  /** Abre la pantalla de pedidos para la mesa seleccionada. */
  onAbrirMesa: (mesa: Mesa) => void
  /** Crea un nuevo pedido para llevar y abre la pantalla de pedidos. */
  onAbrirLlevar: () => void
  /** Reabre una orden existente (ej. un pedido para llevar en curso). */
  onAbrirOrden: (orden: OrdenConDetalle) => void
}

export function Mesas({ onAbrirMesa, onAbrirLlevar, onAbrirOrden }: Props): React.JSX.Element {
  const { mesas, ordenes, ordenDeMesa, editarMesa, agregarMesa, eliminarMesa } = useDatos()
  const paraLlevar = ordenes.filter((o) => o.paraLlevar && o.estado === 'abierta')
  const toast = useToast()
  const [editando, setEditando] = useState<Mesa | null>(null)
  const [nombre, setNombre] = useState('')
  const [capacidad, setCapacidad] = useState(4)
  const [aEliminar, setAEliminar] = useState<Mesa | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editando) {
      setNombre(editando.nombre)
      setCapacidad(editando.capacidad)
      // Enfoca y selecciona tras montar el modal.
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [editando])

  const resumen = useMemo(() => {
    const ocupadas = mesas.filter((m) => m.estado !== 'libre').length
    const porCobrar = mesas.filter((m) => m.estado === 'por_cobrar').length
    const enCurso = mesas.reduce((acc, m) => acc + (ordenDeMesa(m.id)?.total ?? 0), 0)
    return { ocupadas, porCobrar, enCurso }
  }, [mesas, ordenDeMesa])

  const guardar = (): void => {
    if (!editando) return
    editarMesa(editando.id, { nombre, capacidad })
    setEditando(null)
    toast('Mesa actualizada')
  }

  const confirmarEliminar = (): void => {
    if (!aEliminar) return
    eliminarMesa(aEliminar.id)
    toast(`${aEliminar.nombre} eliminada`, 'info')
    setAEliminar(null)
    setEditando(null)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mesas</h1>
          <p className="text-sm text-slate-500">
            Selecciona una mesa para abrir o ver su orden · usa el botón de editar para renombrarla
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-xs">
            <Leyenda color="bg-slate-400" label="Libre" />
            <Leyenda color="bg-slate-800" label="Ocupada" />
            <Leyenda color="bg-amber-500" label="Por cobrar" />
          </div>
          <button
            onClick={onAbrirLlevar}
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Icono nombre="mas" size={16} />
            Pedido para llevar
          </button>
          <button
            onClick={() => {
              agregarMesa()
              toast('Mesa agregada')
            }}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Icono nombre="mas" size={16} />
            Mesa
          </button>
        </div>
      </header>

      {/* Pedidos para llevar activos */}
      {paraLlevar.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Para llevar
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {paraLlevar.map((o) => (
              <button
                key={o.id}
                onClick={() => onAbrirOrden(o)}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
              >
                <span className="font-semibold text-slate-900">{o.nombre}</span>
                <span className="text-sm font-semibold text-slate-700">{pesos(o.total)}</span>
                <span
                  className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
                    o.porCobrar ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${o.porCobrar ? 'bg-amber-500' : 'bg-slate-800'}`}
                  />
                  {o.porCobrar ? 'Por cobrar' : 'En preparación'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Resumen del turno */}
      <div className="mb-5 flex gap-3 text-sm">
        <Stat label="Mesas activas" valor={`${resumen.ocupadas}/${mesas.length}`} />
        <Stat label="Por cobrar" valor={String(resumen.porCobrar)} />
        <Stat label="Consumo en curso" valor={pesos(resumen.enCurso)} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        {mesas
          .slice()
          .sort((a, b) => a.numero - b.numero)
          .map((mesa) => (
            <TarjetaMesa
              key={mesa.id}
              mesa={mesa}
              total={ordenDeMesa(mesa.id)?.total}
              onClick={onAbrirMesa}
              onEditar={setEditando}
            />
          ))}
      </div>

      <Modal
        abierto={editando !== null}
        titulo="Editar mesa"
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button
              onClick={() => editando && setAEliminar(editando)}
              disabled={editando?.estado !== 'libre'}
              title={editando?.estado !== 'libre' ? 'Solo se pueden eliminar mesas libres' : ''}
              className="mr-auto rounded-lg px-4 py-2 text-sm font-semibold text-red-500 enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Eliminar
            </button>
            <button
              onClick={() => setEditando(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Guardar
            </button>
          </>
        }
      >
        <label className="mb-1 block text-sm font-medium text-slate-600">Nombre de la mesa</label>
        <input
          ref={inputRef}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
          placeholder={editando ? `Mesa ${editando.numero}` : ''}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <p className="mb-3 mt-2 text-xs text-slate-400">
          Déjalo vacío para volver al nombre por defecto.
        </p>
        <label className="mb-1 block text-sm font-medium text-slate-600">Capacidad</label>
        <input
          type="number"
          min={1}
          value={capacidad}
          onChange={(e) => setCapacidad(Math.max(1, Number(e.target.value)))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </Modal>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar mesa"
        peligro
        textoConfirmar="Eliminar"
        mensaje={
          <>
            ¿Eliminar <strong>{aEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
          </>
        }
        onConfirmar={confirmarEliminar}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

function Stat({ label, valor }: { label: string; valor: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800">{valor}</div>
    </div>
  )
}

function Leyenda({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-slate-600">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  )
}
