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

// Únicas ladas de 2 dígitos en México (CDMX, Guadalajara, Monterrey); el resto
// del país usa lada de 3 dígitos (ej. Colima 312, Puebla 222, Cancún 998).
const LADAS_DOS_DIGITOS = ['55', '33', '81']

/** Agrupa un teléfono a 10 dígitos en lada + número, ej. "3121234567" -> "312 123 4567". */
export function formatearTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 10)
  const dosDigitos = LADAS_DOS_DIGITOS.includes(digitos.slice(0, 2))
  const lada = digitos.slice(0, dosDigitos ? 2 : 3)
  const resto = digitos.slice(lada.length)
  const partes = dosDigitos
    ? [lada, resto.slice(0, 4), resto.slice(4, 8)]
    : [lada, resto.slice(0, 3), resto.slice(3, 7)]
  return partes.filter(Boolean).join(' ')
}
