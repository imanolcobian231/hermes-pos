import { useState } from 'react'
import type { Producto } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { pesos } from '@renderer/lib/format'

interface Props {
  producto: Producto
  onConfirmar: (modificadorIds: number[]) => void
  onCerrar: () => void
}

// Modal para elegir los modificadores de un producto al agregarlo a la comanda.
// Respeta las reglas de cada grupo (obligatorio/opcional, único/múltiple).
export function SelectorModificadores({ producto, onConfirmar, onCerrar }: Props): React.JSX.Element {
  const grupos = producto.grupos ?? []
  // Selección por grupo: lista de ids de modificador.
  const [seleccion, setSeleccion] = useState<Record<number, number[]>>({})

  const toggle = (grupoId: number, modId: number, multiple: boolean): void => {
    setSeleccion((prev) => {
      const actual = prev[grupoId] ?? []
      if (multiple) {
        const nueva = actual.includes(modId)
          ? actual.filter((x) => x !== modId)
          : [...actual, modId]
        return { ...prev, [grupoId]: nueva }
      }
      // Selección única: reemplaza (permite deseleccionar si no es obligatorio).
      return { ...prev, [grupoId]: actual.includes(modId) ? [] : [modId] }
    })
  }

  const idsSeleccionados = Object.values(seleccion).flat()
  const todosLosMods = grupos.flatMap((g) => g.modificadores)
  const extra = idsSeleccionados.reduce(
    (acc, id) => acc + (todosLosMods.find((m) => m.id === id)?.precio ?? 0),
    0
  )

  const faltanObligatorios = grupos.some(
    (g) => g.obligatorio && (seleccion[g.id]?.length ?? 0) === 0
  )

  return (
    <Modal
      abierto
      titulo={producto.nombre}
      ancho="max-w-md"
      onCerrar={onCerrar}
      pie={
        <>
          <button
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(idsSeleccionados)}
            disabled={faltanObligatorios}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Agregar · {pesos(producto.precio + extra)}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {grupos.map((g) => (
          <div key={g.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{g.nombre}</span>
              <span className="text-xs text-slate-400">
                {g.obligatorio ? 'obligatorio' : 'opcional'} ·{' '}
                {g.multiple ? 'varios' : 'uno'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {g.modificadores.map((m) => {
                const marcado = (seleccion[g.id] ?? []).includes(m.id)
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                      marcado ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <input
                        type={g.multiple ? 'checkbox' : 'radio'}
                        name={`grupo-${g.id}`}
                        checked={marcado}
                        onChange={() => toggle(g.id, m.id, g.multiple)}
                      />
                      {m.nombre}
                    </span>
                    <span className="text-slate-500">
                      {m.precio > 0 ? `+${pesos(m.precio)}` : 'sin costo'}
                    </span>
                  </label>
                )
              })}
              {g.modificadores.length === 0 && (
                <span className="text-xs text-slate-400">Sin opciones en este grupo.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
