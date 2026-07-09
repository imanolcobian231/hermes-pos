import { useEffect, useMemo, useState } from 'react'
import type { NotaVenta, OrdenConDetalle } from '@shared/types'
import { fechaHora, pesos } from '@renderer/lib/format'
import { useImpresion } from '@renderer/store/impresion'
import { logoAVistaPrevia, logoAnkyra } from '@renderer/lib/logo'
import { calcularImpuesto, totalEnLetra } from '@shared/impuestos'
import { agruparLineas } from '@shared/ticket'
import { ETIQUETA_METODO } from '@shared/pagos'

interface Props {
  titulo: string
  orden: OrdenConDetalle
  /** true para reimpresiones del ticket final (marca *** COPIA ***). */
  copia?: boolean
  /** Si viene, el ticket es un comprobante/nota de venta con datos del cliente. */
  notaVenta?: NotaVenta
}

// Previsualización del ticket de cliente (modo simulación).
export function TicketFinal({ titulo, orden, copia, notaVenta }: Props): React.JSX.Element {
  const { cfg } = useImpresion()
  const imp = calcularImpuesto(
    orden.total - orden.descuento,
    cfg ?? { impuestoActivo: false, impuestoTasa: 0, impuestoIncluido: true }
  )
  const logo = useMemo(
    () => (cfg?.logoTicket ? logoAVistaPrevia(cfg.logoTicket) : null),
    [cfg?.logoTicket]
  )
  // Logo de Ankyra al pie, rasterizado igual que en el ticket impreso (B/N,
  // recortado) para que la simulación coincida con lo que sale en papel.
  const cajaAncho =
    cfg?.impresoras.find((i) => i.id === cfg?.impresoraCajaId)?.ancho ?? cfg?.ancho ?? 32
  const paperDots = cajaAncho === 48 ? 576 : 384
  // Logo de Ankyra al pie: ~47% del papel (antes 62.5%, ahora 25% menos).
  const wAnkyra = Math.round((paperDots / 2) * 0.9375)
  // Ancho del logo del negocio en el preview = su proporción REAL de impresión
  // (raster guardado ÷ ancho del papel), para que la simulación no mienta.
  const anchoLogoPct = cfg?.logoTicket ? (cfg.logoTicket.ancho / paperDots) * 100 : 0
  const [pieAnkyra, setPieAnkyra] = useState<string | null>(null)
  useEffect(() => {
    let activo = true
    logoAnkyra(wAnkyra)
      .then((l) => activo && setPieAnkyra(logoAVistaPrevia(l)))
      .catch(() => activo && setPieAnkyra(null))
    return () => {
      activo = false
    }
  }, [wAnkyra])
  // Dirección por renglones (cada línea aparte), igual que impreso.
  const direccionLineas = (cfg?.direccion ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
  return (
    <div className="mx-auto w-64 rounded-lg border border-dashed border-black/10 bg-black/[0.03] px-4 pb-4 pt-2 font-mono text-xs text-tinta">
      {/* Ancho derivado del raster: iguala la proporción real de impresión. */}
      {logo && (
        <img src={logo} alt="Logo" className="mx-auto mb-1" style={{ width: `${anchoLogoPct}%` }} />
      )}
      {cfg?.nombreNegocio && (
        <div className="text-center font-bold">{cfg.nombreNegocio}</div>
      )}
      {direccionLineas.map((ln, i) => (
        <div key={i} className="text-center text-[10px] text-tinta-suave">
          {ln}
        </div>
      ))}
      {cfg?.telefono && (
        <div className="text-center text-[10px] text-tinta-suave">Tel: {cfg.telefono}</div>
      )}
      {cfg?.rfc && (
        <div className="text-center text-[10px] text-tinta-suave">RFC: {cfg.rfc}</div>
      )}
      {(cfg?.mensajeTicket ?? 'Gracias por su visita').trim() && (
        <div className="text-center text-[10px] text-tinta-suave">
          {(cfg?.mensajeTicket ?? 'Gracias por su visita').trim()}
        </div>
      )}
      {/* Leyenda no fiscal, bajo la frase del negocio. */}
      <div className="text-center text-[10px] font-semibold text-tinta-suave">
        ESTE NO ES UN COMPROBANTE FISCAL
      </div>
      {copia && <div className="mt-1 text-center font-bold">*** COPIA ***</div>}
      {notaVenta && (
        <div className="mt-1">
          <div className="text-center font-bold">NOTA DE VENTA</div>
          {notaVenta.razonSocial && <div>Cliente: {notaVenta.razonSocial}</div>}
          {notaVenta.rfc && <div>RFC: {notaVenta.rfc}</div>}
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black/10" />
      <div className="flex justify-between">
        <span>{titulo}</span>
        <span>Ticket #{orden.id}</span>
      </div>
      <div className="text-[10px] text-tinta-suave">{fechaHora(orden.cerradoEn ?? orden.abiertoEn)}</div>
      <div className="my-2 border-t border-dashed border-black/10" />

      {/* Encabezado de columnas en negritas, pegado a los productos */}
      <div className="mb-1 flex justify-between font-bold">
        <span>Cant. Descripción</span>
        <span>Importe</span>
      </div>

      {agruparLineas(orden.detalle).map((d, i) => {
        const sumaMods = d.modificadores.reduce((s, m) => s + m.precio, 0)
        return (
          <div key={i}>
            <div className="flex justify-between">
              <span className="pr-2">
                {d.cantidad} {d.nombreProducto}
              </span>
              <span>{pesos(d.cantidad * (d.precioUnitario - sumaMods))}</span>
            </div>
            {d.modificadores.map((m, j) => (
              <div key={j} className="flex justify-between pl-3 text-tinta-suave">
                <span>+ {m.nombre}</span>
                {m.precio > 0 && <span>{pesos(d.cantidad * m.precio)}</span>}
              </div>
            ))}
          </div>
        )
      })}

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
      {imp.lineas.length > 0 && (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{pesos(imp.base)}</span>
          </div>
          {imp.lineas.map((t, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {t.nombre} {t.tasa}%
              </span>
              <span>{pesos(t.monto)}</span>
            </div>
          ))}
        </>
      )}
      {orden.propina > 0 && (
        <>
          <div className="flex justify-between">
            <span>Venta</span>
            <span>{pesos(imp.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Propina</span>
            <span>{pesos(orden.propina)}</span>
          </div>
        </>
      )}
      <div className="mt-2 flex items-center justify-between text-lg font-extrabold">
        <span>TOTAL</span>
        <span>{pesos(imp.total + orden.propina)}</span>
      </div>
      <div className="mt-1 text-center text-[10px] text-tinta-suave">
        Son {totalEnLetra(imp.total + orden.propina)}
      </div>

      {orden.pagos && orden.pagos.length > 0 ? (
        <>
          <div className="my-2 border-t border-dashed border-black/10" />
          {orden.pagos.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{ETIQUETA_METODO[p.metodo]}</span>
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
            <span>{ETIQUETA_METODO[orden.metodoPago]}</span>
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
      {pieAnkyra ? (
        /* Logo de Ankyra (ya trae "Powered by Olyssea"). ~62% del papel. */
        <img src={pieAnkyra} alt="ANKYRA · Powered by Olyssea" className="mx-auto mb-1 w-[47%]" />
      ) : (
        <>
          <div className="text-center text-base font-extrabold tracking-wide">ANKYRA</div>
          <div className="text-center text-[10px] text-tinta-suave">Powered by Olyssea</div>
        </>
      )}
    </div>
  )
}
