import type { MetodoPago, OrdenConDetalle } from '@shared/types'
import { fechaHora, pesos } from '@renderer/lib/format'
import { useImpresion } from '@renderer/store/impresion'
import { calcularImpuesto, totalEnLetra } from '@shared/impuestos'
import { agruparLineas } from '@shared/ticket'

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
  const { cfg } = useImpresion()
  const imp = calcularImpuesto(
    orden.total - orden.descuento,
    cfg ?? { impuestoActivo: false, impuestoTasa: 0, impuestoIncluido: true }
  )
  return (
    <div className="mx-auto w-64 rounded-lg border border-dashed border-black/10 bg-black/[0.03] p-4 font-mono text-xs text-tinta">
      {cfg?.nombreNegocio && (
        <div className="text-center font-bold">{cfg.nombreNegocio}</div>
      )}
      {cfg?.direccion && (
        <div className="text-center text-[10px] text-tinta-suave">{cfg.direccion}</div>
      )}
      {cfg?.telefono && (
        <div className="text-center text-[10px] text-tinta-suave">Tel: {cfg.telefono}</div>
      )}
      <div className="text-center text-[10px] text-tinta-suave">Gracias por su visita</div>
      {copia && <div className="mt-1 text-center font-bold">*** COPIA ***</div>}
      <div className="my-2 border-t border-dashed border-black/10" />
      <div className="flex justify-between">
        <span>{titulo}</span>
        <span>Ticket #{orden.id}</span>
      </div>
      <div className="text-[10px] text-tinta-suave">{fechaHora(orden.cerradoEn ?? orden.abiertoEn)}</div>
      <div className="my-2 border-t border-dashed border-black/10" />

      {agruparLineas(orden.detalle).map((d, i) => (
        <div key={i}>
          <div className="flex justify-between">
            <span className="pr-2">
              {d.cantidad} x {d.nombreProducto}
            </span>
            <span>{pesos(d.cantidad * d.precioUnitario)}</span>
          </div>
          {d.modificadores.map((m, j) => (
            <div key={j} className="pl-3 text-tinta-suave">
              + {m.nombre}
            </div>
          ))}
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black/10" />
      {orden.descuento > 0 && (
        <>
          <div className="flex justify-between">
            <span>Importe</span>
            <span>{pesos(orden.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Descuento</span>
            <span>-{pesos(orden.descuento)}</span>
          </div>
        </>
      )}
      {imp.tasa > 0 && (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{pesos(imp.base)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA {imp.tasa}%</span>
            <span>{pesos(imp.iva)}</span>
          </div>
        </>
      )}
      <div className="mt-2 flex items-center justify-between text-lg font-extrabold">
        <span>TOTAL</span>
        <span>{pesos(imp.total)}</span>
      </div>
      <div className="mt-1 text-[10px] text-tinta-suave">Son {totalEnLetra(imp.total)}</div>

      {orden.pagos && orden.pagos.length > 0 ? (
        <>
          <div className="my-2 border-t border-dashed border-black/10" />
          {orden.pagos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{etiquetaMetodo[p.metodo]}</span>
              <span>{pesos(p.monto)}</span>
            </div>
          ))}
          {orden.cambio != null && orden.cambio > 0 && (
            <div className="flex justify-between">
              <span>Cambio</span>
              <span>{pesos(orden.cambio)}</span>
            </div>
          )}
        </>
      ) : orden.metodoPago === 'credito' ? (
        <>
          <div className="my-2 border-t border-dashed border-black/10" />
          <div className="flex justify-between font-semibold">
            <span>CRÉDITO (fiado)</span>
            <span>{pesos(imp.total)}</span>
          </div>
        </>
      ) : orden.metodoPago && orden.metodoPago !== 'mixto' ? (
        <>
          <div className="my-2 border-t border-dashed border-black/10" />
          <div className="flex justify-between">
            <span>{etiquetaMetodo[orden.metodoPago]}</span>
            <span>{pesos(orden.montoRecibido ?? imp.total)}</span>
          </div>
          {orden.metodoPago === 'efectivo' && (
            <div className="flex justify-between">
              <span>Cambio</span>
              <span>{pesos(orden.cambio ?? 0)}</span>
            </div>
          )}
        </>
      ) : null}

      <div className="my-2 border-t border-dashed border-black/10" />
      <div className="text-center text-base font-extrabold tracking-wide">Hermes</div>
      <div className="text-center text-[10px] text-tinta-suave">Powered by Olyssea</div>
    </div>
  )
}
