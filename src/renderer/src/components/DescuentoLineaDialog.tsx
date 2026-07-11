import { useEffect, useState } from 'react'
import type { DetalleOrden } from '@shared/types'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'

const PRESETS = [10, 15, 20, 50]

// Diálogo para descontar una sola línea del carrito, por porcentaje (%) o por
// monto ($). Siempre devuelve el descuento en pesos vía onAplicar.
export function DescuentoLineaDialog({
  linea,
  onCerrar,
  onAplicar
}: {
  linea: DetalleOrden | null
  onCerrar: () => void
  onAplicar: (monto: number) => void
}): React.JSX.Element {
  const [modo, setModo] = useState<'pct' | 'monto'>('pct')
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (!linea) return
    // Si ya tenía descuento, muéstralo como monto ($); si no, arranca en %.
    if (linea.descuento > 0) {
      setModo('monto')
      setTexto(String(linea.descuento))
    } else {
      setModo('pct')
      setTexto('')
    }
  }, [linea?.id, linea?.descuento])

  const importe = linea ? linea.cantidad * linea.precioUnitario : 0
  const num = parseFloat(texto) || 0
  const monto =
    modo === 'pct'
      ? Math.round(Math.min(importe, (importe * Math.min(num, 100)) / 100) * 100) / 100
      : Math.max(0, Math.min(num, importe))

  const pill = (activo: boolean): string =>
    `rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
      activo
        ? 'border-transparent bg-acento text-white shadow-sm'
        : 'border-black/[0.06] bg-black/[0.02] text-tinta-suave hover:border-acento/40 hover:text-acento'
    }`

  const seg = (activo: boolean): string =>
    `rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
      activo ? 'bg-white text-acento shadow-sm' : 'text-tinta-suave hover:text-tinta'
    }`

  return (
    <Modal
      abierto={linea !== null}
      titulo={linea ? `Descuento · ${linea.nombreProducto}` : 'Descuento'}
      ancho="max-w-sm"
      onCerrar={onCerrar}
      pie={
        <>
          <button onClick={onCerrar} className="btn-texto">
            Cancelar
          </button>
          <button onClick={() => onAplicar(monto)} className="btn-primario">
            {monto > 0 ? `Descontar ${pesos(monto)}` : 'Quitar descuento'}
          </button>
        </>
      }
    >
      {linea && (
        <>
          <div className="mb-3 flex justify-between rounded-xl bg-black/[0.03] px-4 py-3 text-sm">
            <span className="text-tinta-suave">Importe de la línea</span>
            <span className="font-semibold tabular-nums text-tinta">{pesos(importe)}</span>
          </div>

          {/* Porcentajes rápidos */}
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => setTexto('')} className={pill(num === 0)}>
              Sin
            </button>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setModo('pct')
                  setTexto(String(p))
                }}
                className={pill(modo === 'pct' && num === p)}
              >
                {p}%
              </button>
            ))}
          </div>

          {/* Selector %/$ + valor a mano */}
          <label className="mb-1 block text-sm font-medium text-tinta-suave">
            Descuento a mano
          </label>
          <div className="flex items-stretch gap-2">
            <div className="flex shrink-0 rounded-lg bg-black/[0.05] p-1">
              <button type="button" onClick={() => setModo('pct')} className={seg(modo === 'pct')}>
                %
              </button>
              <button type="button" onClick={() => setModo('monto')} className={seg(modo === 'monto')}>
                $
              </button>
            </div>
            <div className="flex flex-1 items-center rounded-lg border border-black/10 px-3 transition focus-within:border-acento focus-within:ring-2 focus-within:ring-acento/15">
              <span className="text-sm text-tinta-suave">{modo === 'pct' ? '%' : '$'}</span>
              <input
                type="number"
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={modo === 'pct' ? 'Porcentaje' : 'Monto'}
                className="w-full bg-transparent py-2.5 pl-2 text-right text-lg font-semibold outline-none"
              />
            </div>
          </div>

          <p className="mt-3 text-sm text-tinta-suave">
            Descuenta <strong className="text-tinta">{pesos(monto)}</strong> · queda en{' '}
            <strong className="text-tinta">{pesos(importe - monto)}</strong>
          </p>
        </>
      )}
    </Modal>
  )
}
