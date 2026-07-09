const formateadorMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2
})

/** Formatea un número como moneda mexicana, ej. 25 -> "$25.00". */
export function pesos(monto: number): string {
  return formateadorMXN.format(monto || 0)
}

/** Primera letra en mayúscula y el resto en minúscula, ej. "TACOS" -> "Tacos". */
export function capitalizar(texto: string): string {
  if (!texto) return ''
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase()
}

/** Hora corta local, ej. "14:35". */
export function hora(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/** Fecha y hora local, ej. "20 jun, 14:35". */
export function fechaHora(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
