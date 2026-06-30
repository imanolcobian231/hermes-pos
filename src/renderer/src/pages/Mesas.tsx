import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mesa, OrdenConDetalle } from '@shared/types'
import { TarjetaMesa } from '@renderer/components/TarjetaMesa'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'

// Paleta de colores para asignar a las mesas (zonas).
const COLORES_MESA = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
]

interface Props {
  /** Abre la pantalla de pedidos para la mesa seleccionada. */
  onAbrirMesa: (mesa: Mesa) => void
  /** Crea un nuevo pedido para llevar (con nombre opcional) y abre Pedidos. */
  onAbrirLlevar: (nombre?: string) => void
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
  const [color, setColor] = useState<string | undefined>(undefined)
  const [aEliminar, setAEliminar] = useState<Mesa | null>(null)
  const [llevarAbierto, setLlevarAbierto] = useState(false)
  const [nombreLlevar, setNombreLlevar] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editando) {
      setNombre(editando.nombre)
      setCapacidad(editando.capacidad)
      setColor(editando.color)
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
    editarMesa(editando.id, { nombre, capacidad, color })
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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-tinta">Mesas</h1>
          <p className="mt-1 text-sm text-tinta-suave">
            Selecciona una mesa para abrir o ver su orden · usa el botón de editar para renombrarla
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4 text-xs">
            <Leyenda color="bg-black/25" label="Libre" />
            <Leyenda color="bg-acento" label="Ocupada" />
            <Leyenda color="bg-amber-500" label="Por cobrar" />
          </div>
          <button
            onClick={() => {
              setNombreLlevar('')
              setLlevarAbierto(true)
            }}
            className="btn-primario"
          >
            <Icono nombre="mas" size={16} />
            Pedido para llevar
          </button>
          <button
            onClick={() => {
              agregarMesa()
              toast('Mesa agregada')
            }}
            className="btn-neutro"
          >
            <Icono nombre="mas" size={16} />
            Mesa
          </button>
        </div>
      </header>

      {/* Pedidos para llevar activos */}
      {paraLlevar.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Para llevar
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {paraLlevar.map((o) => (
              <button
                key={o.id}
                onClick={() => onAbrirOrden(o)}
                className="tarjeta flex flex-col gap-1 p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <span className="font-semibold text-tinta">{o.nombre}</span>
                <span className="text-sm font-semibold text-tinta-suave">{pesos(o.total)}</span>
                <span
                  className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
                    o.porCobrar ? 'text-amber-700' : 'text-tinta-suave'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${o.porCobrar ? 'bg-amber-500' : 'bg-acento'}`} />
                  {o.porCobrar ? 'Por cobrar' : 'En preparación'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Resumen del turno */}
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
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
              className="mr-auto rounded-full px-4 py-2 text-sm font-semibold text-red-600 enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:text-tinta-suave/40"
            >
              Eliminar
            </button>
            <button onClick={() => setEditando(null)} className="btn-texto">
              Cancelar
            </button>
            <button onClick={guardar} className="btn-primario">
              Guardar
            </button>
          </>
        }
      >
        <label className="mb-1 block text-sm font-medium text-tinta-suave">Nombre de la mesa</label>
        <input
          ref={inputRef}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardar()}
          placeholder={editando ? `Mesa ${editando.numero}` : ''}
          className="campo"
        />
        <p className="mb-3 mt-2 text-xs text-tinta-suave/80">
          Déjalo vacío para volver al nombre por defecto.
        </p>
        <label className="mb-1 block text-sm font-medium text-tinta-suave">Capacidad</label>
        <input
          type="number"
          min={1}
          value={capacidad}
          onChange={(e) => setCapacidad(Math.max(1, Number(e.target.value)))}
          className="campo"
        />

        <label className="mb-1 mt-3 block text-sm font-medium text-tinta-suave">Color</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setColor(undefined)}
            title="Sin color"
            className={`flex h-8 w-8 items-center justify-center rounded-full border bg-white text-xs text-tinta-suave ${
              !color ? 'border-acento ring-2 ring-acento/25' : 'border-black/15'
            }`}
          >
            ✕
          </button>
          {COLORES_MESA.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 rounded-full border transition ${
                color === c ? 'border-acento ring-2 ring-acento/30' : 'border-transparent'
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-tinta-suave/80">Útil para distinguir zonas (terraza, barra…).</p>
      </Modal>

      <Modal
        abierto={llevarAbierto}
        titulo="Pedido para llevar"
        onCerrar={() => setLlevarAbierto(false)}
        pie={
          <>
            <button onClick={() => setLlevarAbierto(false)} className="btn-texto">
              Cancelar
            </button>
            <button
              onClick={() => {
                setLlevarAbierto(false)
                onAbrirLlevar(nombreLlevar.trim() || undefined)
              }}
              className="btn-primario"
            >
              Crear pedido
            </button>
          </>
        }
      >
        <label className="mb-1 block text-sm font-medium text-tinta-suave">
          Nombre del pedido (opcional)
        </label>
        <input
          autoFocus
          value={nombreLlevar}
          onChange={(e) => setNombreLlevar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setLlevarAbierto(false)
              onAbrirLlevar(nombreLlevar.trim() || undefined)
            }
          }}
          placeholder="Ej. Juan, mostrador, teléfono…"
          className="campo"
        />
        <p className="mt-2 text-xs text-tinta-suave">
          Déjalo vacío para numerarlo automáticamente (“Para llevar #N”).
        </p>
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
    <div className="tarjeta px-4 py-2.5 shadow-sm">
      <div className="text-xs text-tinta-suave">{label}</div>
      <div className="text-lg font-semibold text-tinta">{valor}</div>
    </div>
  )
}

function Leyenda({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 text-tinta-suave">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  )
}
