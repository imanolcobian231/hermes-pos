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
            className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(idsSeleccionados)}
            disabled={faltanObligatorios}
            className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
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
              <span className="text-sm font-semibold text-tinta">{g.nombre}</span>
              <span className="text-xs text-tinta-suave">
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
                      marcado ? 'border-acento bg-black/[0.03]' : 'border-black/[0.06] hover:border-black/15'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-tinta">
                      <input
                        type={g.multiple ? 'checkbox' : 'radio'}
                        name={`grupo-${g.id}`}
                        checked={marcado}
                        onChange={() => toggle(g.id, m.id, g.multiple)}
                      />
                      {m.nombre}
                    </span>
                    <span className="text-tinta-suave">
                      {m.precio > 0 ? `+${pesos(m.precio)}` : 'sin costo'}
                    </span>
                  </label>
                )
              })}
              {g.modificadores.length === 0 && (
                <span className="text-xs text-tinta-suave">Sin opciones en este grupo.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
