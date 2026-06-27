import type { Mesa, EstadoMesa } from '@shared/types'
import { pesos } from '@renderer/lib/format'
import { Icono } from '@renderer/components/Icono'

const estilosPorEstado: Record<
  EstadoMesa,
  { punto: string; etiqueta: string; texto: string; barra: string }
> = {
  libre: {
    punto: 'bg-black/25',
    etiqueta: 'text-tinta-suave',
    texto: 'Libre',
    barra: 'bg-black/10'
  },
  ocupada: {
    punto: 'bg-acento',
    etiqueta: 'text-acento',
    texto: 'Ocupada',
    barra: 'bg-acento'
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
      className="group relative flex aspect-square cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.06] bg-superficie p-4 shadow-sm transition hover:shadow-md"
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
          className="absolute right-2 top-2.5 rounded-lg p-1 text-tinta-suave/50 opacity-0 transition hover:bg-black/[0.05] hover:text-tinta group-hover:opacity-100"
          aria-label={`Editar ${mesa.nombre}`}
          title="Editar mesa"
        >
          <Icono nombre="editar" size={15} />
        </button>
      )}

      <div>
        <div className="text-lg font-semibold leading-tight text-tinta">{mesa.nombre}</div>
        <div className="text-xs text-tinta-suave">{mesa.capacidad} personas</div>
      </div>

      <div>
        {mesa.estado !== 'libre' && total != null && total > 0 && (
          <div className="mb-1.5 text-sm font-semibold text-tinta">{pesos(total)}</div>
        )}
        <div className={`flex items-center gap-1.5 text-xs font-medium ${estilo.etiqueta}`}>
          <span className={`h-2 w-2 rounded-full ${estilo.punto}`} />
          {estilo.texto}
        </div>
      </div>
    </div>
  )
}
