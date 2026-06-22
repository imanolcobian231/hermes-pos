import type { Mesa, EstadoMesa } from '@shared/types'
import { pesos } from '@renderer/lib/format'
import { Icono } from '@renderer/components/Icono'

const estilosPorEstado: Record<
  EstadoMesa,
  { punto: string; etiqueta: string; texto: string; barra: string }
> = {
  libre: {
    punto: 'bg-slate-400',
    etiqueta: 'text-slate-500',
    texto: 'Libre',
    barra: 'bg-slate-200'
  },
  ocupada: {
    punto: 'bg-slate-800',
    etiqueta: 'text-slate-700',
    texto: 'Ocupada',
    barra: 'bg-slate-800'
  },
  por_cobrar: {
    punto: 'bg-amber-500',
    etiqueta: 'text-amber-700',
    texto: 'Por cobrar',
    barra: 'bg-amber-500'
  }
}

interface Props {
  mesa: Mesa
  total?: number
  onClick?: (mesa: Mesa) => void
  onEditar?: (mesa: Mesa) => void
}

export function TarjetaMesa({ mesa, total, onClick, onEditar }: Props): React.JSX.Element {
  const estilo = estilosPorEstado[mesa.estado]

  return (
    <div
      onClick={() => onClick?.(mesa)}
      className="group relative flex aspect-square cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm"
    >
      {mesa.color ? (
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: mesa.color }} />
      ) : (
        <span className={`absolute inset-x-0 top-0 h-1 ${estilo.barra}`} />
      )}

      {onEditar && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEditar(mesa)
          }}
          className="absolute right-2 top-2.5 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
          aria-label={`Editar ${mesa.nombre}`}
          title="Editar mesa"
        >
          <Icono nombre="editar" size={15} />
        </button>
      )}

      <div>
        <div className="text-lg font-semibold leading-tight text-slate-900">{mesa.nombre}</div>
        <div className="text-xs text-slate-400">{mesa.capacidad} personas</div>
      </div>

      <div>
        {mesa.estado !== 'libre' && total != null && total > 0 && (
          <div className="mb-1.5 text-sm font-semibold text-slate-800">{pesos(total)}</div>
        )}
        <div className={`flex items-center gap-1.5 text-xs font-medium ${estilo.etiqueta}`}>
          <span className={`h-2 w-2 rounded-full ${estilo.punto}`} />
          {estilo.texto}
        </div>
      </div>
    </div>
  )
}
