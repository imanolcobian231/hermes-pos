import { useEffect, useState } from 'react'
import type { NotaVenta } from '@shared/types'
import { Modal } from '@renderer/components/Modal'

// Captura los datos del cliente para un comprobante / nota de venta (no fiscal)
// y los devuelve al confirmar. No es una factura del SAT.
export function NotaVentaDialog({
  abierto,
  onCerrar,
  onImprimir
}: {
  abierto: boolean
  onCerrar: () => void
  onImprimir: (nota: NotaVenta) => void
}): React.JSX.Element {
  const [razonSocial, setRazonSocial] = useState('')
  const [rfc, setRfc] = useState('')

  useEffect(() => {
    if (abierto) {
      setRazonSocial('')
      setRfc('')
    }
  }, [abierto])

  const imprimir = (): void => {
    onImprimir({ razonSocial: razonSocial.trim() || undefined, rfc: rfc.trim().toUpperCase() || undefined })
  }

  return (
    <Modal
      abierto={abierto}
      titulo="Nota de venta (comprobante)"
      onCerrar={onCerrar}
      pie={
        <>
          <button onClick={onCerrar} className="btn-texto">
            Cancelar
          </button>
          <button onClick={imprimir} className="btn-primario">
            Imprimir comprobante
          </button>
        </>
      }
    >
      <label className="mb-1 block text-sm font-medium text-tinta-suave">Nombre o razón social</label>
      <input
        autoFocus
        value={razonSocial}
        onChange={(e) => setRazonSocial(e.target.value)}
        placeholder="Ej. Juan Pérez / Comercializadora SA de CV"
        className="mb-3 w-full rounded-lg border border-black/10 px-3 py-2 text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
      />
      <label className="mb-1 block text-sm font-medium text-tinta-suave">RFC (opcional)</label>
      <input
        value={rfc}
        onChange={(e) => setRfc(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && imprimir()}
        placeholder="XAXX010101000"
        className="w-full rounded-lg border border-black/10 px-3 py-2 uppercase text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
      />
      <p className="mt-3 text-xs text-tinta-suave">
        Es un comprobante de venta, <strong>no una factura fiscal (CFDI)</strong>. Imprime el ticket
        con estos datos del cliente.
      </p>
    </Modal>
  )
}
