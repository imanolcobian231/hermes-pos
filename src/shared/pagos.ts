import type { MetodoPagoOrden } from './types'

// Etiquetas legibles de cada método de pago. Única fuente para tickets, corte,
// historial y finanzas (main y renderer).
export const ETIQUETA_METODO: Record<MetodoPagoOrden, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  mixto: 'Pago mixto',
  credito: 'Crédito (fiado)'
}
