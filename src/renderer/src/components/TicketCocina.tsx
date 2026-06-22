import type { DetalleOrden } from '@shared/types'
import { hora } from '@renderer/lib/format'

interface Props {
  titulo: string
  lineas: DetalleOrden[]
  /** true cuando la orden ya tenía envíos previos (marca *** ADICIONAL ***). */
  adicional?: boolean
  /** true para reimpresiones (marca *** REIMPRESION ***). */
  reimpresion?: boolean
}

// Previsualización de lo que se imprimiría en la térmica (modo simulación).
// Solo incluye las líneas del envío diferencial.
export function TicketCocina({ titulo, lineas, adicional, reimpresion }: Props): React.JSX.Element {
  return (
    <div className="mx-auto w-64 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs text-slate-800">
      <div className="text-center font-bold">*** COCINA ***</div>
      {adicional && <div className="text-center font-bold">*** ADICIONAL ***</div>}
      {reimpresion && <div className="text-center font-bold">*** REIMPRESION ***</div>}
      <div className="my-2 border-t border-dashed border-slate-300" />
      <div className="flex justify-between">
        <span>{titulo}</span>
        <span>{hora(new Date().toISOString())}</span>
      </div>
      <div className="my-2 border-t border-dashed border-slate-300" />
      {lineas.map((l) => (
        <div key={l.id} className="mb-1">
          <div className="flex justify-between">
            <span>
              {l.cantidad} x {l.nombreProducto}
            </span>
          </div>
          {l.modificadores.map((m) => (
            <div key={m.id} className="pl-3 text-slate-600">
              + {m.nombre}
            </div>
          ))}
          {l.notas && <div className="pl-3 italic text-slate-500">&gt; {l.notas}</div>}
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-slate-300" />
      <div className="text-center text-[10px] text-slate-400">Hermes POS · simulación</div>
    </div>
  )
}
