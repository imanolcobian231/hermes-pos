import type { MetodoPago, OrdenConDetalle } from '@shared/types'
import { fechaHora, pesos } from '@renderer/lib/format'

interface Props {
  titulo: string
  orden: OrdenConDetalle
  /** true para reimpresiones del ticket final (marca *** COPIA ***). */
  copia?: boolean
}

const etiquetaMetodo: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
}

// Previsualización del ticket de cliente (modo simulación).
export function TicketFinal({ titulo, orden, copia }: Props): React.JSX.Element {
  return (
    <div className="mx-auto w-64 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs text-slate-800">
      <div className="text-center font-bold">HERMES POS</div>
      <div className="text-center text-[10px] text-slate-500">Gracias por su visita</div>
      {copia && <div className="mt-1 text-center font-bold">*** COPIA ***</div>}
      <div className="my-2 border-t border-dashed border-slate-300" />
      <div className="flex justify-between">
        <span>{titulo}</span>
        <span>#{orden.id}</span>
      </div>
      <div className="text-[10px] text-slate-500">{fechaHora(orden.cerradoEn ?? orden.abiertoEn)}</div>
      <div className="my-2 border-t border-dashed border-slate-300" />

      {orden.detalle.map((d) => (
        <div key={d.id}>
          <div className="flex justify-between">
            <span className="pr-2">
              {d.cantidad} x {d.nombreProducto}
            </span>
            <span>{pesos(d.cantidad * d.precioUnitario)}</span>
          </div>
          {d.modificadores.map((m) => (
            <div key={m.id} className="pl-3 text-slate-500">
              + {m.nombre}
            </div>
          ))}
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-slate-300" />
      {orden.descuento > 0 && (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{pesos(orden.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>-{pesos(orden.descuento)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{pesos(orden.total - orden.descuento)}</span>
      </div>

      {orden.metodoPago && (
        <>
          <div className="my-2 border-t border-dashed border-slate-300" />
          <div className="flex justify-between">
            <span>{etiquetaMetodo[orden.metodoPago]}</span>
            <span>{pesos(orden.montoRecibido ?? orden.total)}</span>
          </div>
          {orden.metodoPago === 'efectivo' && (
            <div className="flex justify-between">
              <span>Cambio</span>
              <span>{pesos(orden.cambio ?? 0)}</span>
            </div>
          )}
        </>
      )}

      <div className="my-2 border-t border-dashed border-slate-300" />
      <div className="text-center text-[10px] text-slate-400">Hermes POS · simulación</div>
    </div>
  )
}
