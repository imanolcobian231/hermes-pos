import { useState } from 'react'
import type { NotaVenta, OrdenConDetalle } from '@shared/types'
import { calcularImpuesto } from '@shared/impuestos'
import { ETIQUETA_METODO } from '@shared/pagos'
import { Modal } from '@renderer/components/Modal'
import { NotaVentaDialog } from '@renderer/components/NotaVentaDialog'
import { Icono } from '@renderer/components/Icono'
import { useToast } from '@renderer/components/Toast'
import { useDatos } from '@renderer/store/datos'
import { useImpresion } from '@renderer/store/impresion'
import { useAuth } from '@renderer/store/auth'
import { fechaHora, pesos } from '@renderer/lib/format'

interface Props {
  abierto: boolean
  titulo: string
  /** Tickets (órdenes cobradas) a listar, recientes primero. */
  tickets: OrdenConDetalle[]
  cargando?: boolean
  vacio?: string
  onCerrar: () => void
}

// Modal que lista tickets cobrados y permite reimprimir una copia o generar una
// nota de venta (comprobante). Lo usa el historial por mesa y los últimos
// tickets del modo tiendita.
export function TicketsRecientes({
  abierto,
  titulo,
  tickets,
  cargando,
  vacio = 'Sin tickets.',
  onCerrar
}: Props): React.JSX.Element {
  const { registrarReimpresion } = useDatos()
  const { imprimirFinal, cfg } = useImpresion()
  const { usuarioActual } = useAuth()
  const toast = useToast()
  const [reimprimiendo, setReimprimiendo] = useState<number | null>(null)
  const [notaPara, setNotaPara] = useState<OrdenConDetalle | null>(null)

  // Total realmente pagado (neto + impuesto + propina), igual que el impreso.
  const totalPagado = (o: OrdenConDetalle): number => {
    const imp = calcularImpuesto(
      o.total - o.descuento,
      cfg ?? { impuestoActivo: false, impuestoTasa: 0, impuestoIncluido: true }
    )
    return imp.total + (o.propina || 0)
  }

  const reimprimir = async (o: OrdenConDetalle): Promise<void> => {
    setReimprimiendo(o.id)
    try {
      await registrarReimpresion('final', o.id, usuarioActual?.nombre)
      await imprimirFinal(o.id, { copia: true })
      toast('Copia del ticket reimpresa', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo reimprimir el ticket', 'error')
    } finally {
      setReimprimiendo(null)
    }
  }

  const imprimirNotaVenta = async (nota: NotaVenta): Promise<void> => {
    if (!notaPara) return
    const id = notaPara.id
    setNotaPara(null)
    try {
      await imprimirFinal(id, { notaVenta: nota })
      toast('Comprobante impreso', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir el comprobante', 'error')
    }
  }

  return (
    <>
      <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar} ancho="max-w-lg">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-tinta-suave">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-tinta" />
            Cargando…
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-sm text-tinta-suave">{vacio}</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tickets.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-superficie px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-tinta">{pesos(totalPagado(o))}</div>
                  <div className="text-xs text-tinta-suave">
                    {fechaHora(o.cerradoEn)} · {ETIQUETA_METODO[o.metodoPago ?? 'efectivo']}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setNotaPara(o)}
                    disabled={reimprimiendo !== null}
                    className="btn-neutro disabled:cursor-not-allowed disabled:opacity-50"
                    title="Imprimir comprobante / nota de venta"
                  >
                    <Icono nombre="recibo" size={16} />
                    Nota
                  </button>
                  <button
                    onClick={() => void reimprimir(o)}
                    disabled={reimprimiendo !== null}
                    className="btn-neutro disabled:cursor-not-allowed disabled:opacity-50"
                    title="Reimprimir copia de este ticket"
                  >
                    {reimprimiendo === o.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-tinta" />
                    ) : (
                      <Icono nombre="imprimir" size={16} />
                    )}
                    Reimprimir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <NotaVentaDialog
        abierto={notaPara !== null}
        onCerrar={() => setNotaPara(null)}
        onImprimir={imprimirNotaVenta}
      />
    </>
  )
}
