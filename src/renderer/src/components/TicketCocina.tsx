import type { DetalleOrden } from '@shared/types'
import { hora } from '@renderer/lib/format'
import { useImpresion } from '@renderer/store/impresion'

interface Props {
  titulo: string
  lineas: DetalleOrden[]
  /** true cuando la orden ya tenía envíos previos (marca *** ADICIONAL ***). */
  adicional?: boolean
  /** true para reimpresiones (marca *** REIMPRESION ***). */
  reimpresion?: boolean
  /** true para correcciones tras quitar/restar algo ya enviado (*** CORRECCION ***). */
  correccion?: boolean
  /** Área de la comanda: cambia el encabezado y, en barra, no separa por comensal. */
  area?: 'cocina' | 'barra'
}

// Agrupa las líneas por comensal, ordenadas por número de comensal.
export function agruparPorComensal(lineas: DetalleOrden[]): [number, DetalleOrden[]][] {
  const mapa = new Map<number, DetalleOrden[]>()
  for (const l of lineas) {
    const c = l.comensal ?? 1
    if (!mapa.has(c)) mapa.set(c, [])
    mapa.get(c)!.push(l)
  }
  return [...mapa.entries()].sort((a, b) => a[0] - b[0])
}

// Previsualización de lo que se imprimiría en la térmica (modo simulación).
// Solo incluye las líneas del envío diferencial.
export function TicketCocina({
  titulo,
  lineas,
  adicional,
  reimpresion,
  correccion,
  area
}: Props): React.JSX.Element {
  const { cfg } = useImpresion()
  // Comensal: solo en cocina (la barra nunca separa), si el ajuste lo permite y hay más de uno.
  const mostrarComensal =
    area !== 'barra' &&
    cfg?.separarComensales !== false &&
    new Set(lineas.map((l) => l.comensal ?? 1)).size > 1
  const encabezado = correccion ? '*** CORRECCION ***' : area === 'barra' ? '*** BARRA ***' : '*** COCINA ***'
  return (
    <div className="mx-auto w-64 rounded-lg border border-dashed border-black/10 bg-black/[0.03] p-4 font-mono text-xs text-tinta">
      <div className="text-center font-bold">{encabezado}</div>
      {adicional && <div className="text-center font-bold">*** ADICIONAL ***</div>}
      {reimpresion && <div className="text-center font-bold">*** REIMPRESION ***</div>}
      <div className="my-2 border-t border-dashed border-black/10" />
      <div className="flex justify-between">
        <span>{titulo}</span>
        <span>{hora(new Date().toISOString())}</span>
      </div>
      <div className="my-2 border-t border-dashed border-black/10" />
      {agruparPorComensal(lineas).map(([comensal, items]) => (
        <div key={comensal} className="mb-1.5">
          {mostrarComensal && (
            <div className="my-1 font-bold uppercase">— Comensal {comensal} —</div>
          )}
          {items.map((l) => (
            <div key={l.id} className="mb-1">
              <div className="flex justify-between">
                <span>
                  {l.cantidad} x {l.nombreProducto}
                </span>
              </div>
              {l.modificadores.map((m) => (
                <div key={m.id} className="pl-3 text-tinta-suave">
                  + {m.nombre}
                </div>
              ))}
              {l.notas && <div className="pl-3 italic text-tinta-suave">&gt; {l.notas}</div>}
            </div>
          ))}
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-black/10" />
      <div className="text-center text-[10px] text-tinta-suave">Hermes · simulación</div>
    </div>
  )
}
