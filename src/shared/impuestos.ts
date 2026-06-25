// Cálculo de impuestos (IVA) y conversión de importe a letra. Compartido entre
// el proceso main (tickets) y el renderer (Cobro / vista previa).

export interface ConfigImpuesto {
  impuestoActivo: boolean
  /** Tasa en porcentaje, ej. 16 para IVA 16%. */
  impuestoTasa: number
  /** true = los precios YA incluyen el impuesto; false = se agrega al total. */
  impuestoIncluido: boolean
}

export interface DesgloseImpuesto {
  /** Importe sin impuesto. */
  base: number
  /** Monto del impuesto. */
  iva: number
  /** Total a pagar (base + iva, o el mismo neto si el IVA va incluido). */
  total: number
  /** Tasa aplicada (%). 0 si no hay impuesto. */
  tasa: number
}

/** Desglosa el impuesto a partir del neto (total de líneas menos descuento). */
export function calcularImpuesto(neto: number, cfg: ConfigImpuesto): DesgloseImpuesto {
  if (!cfg.impuestoActivo || cfg.impuestoTasa <= 0) {
    return { base: neto, iva: 0, total: neto, tasa: 0 }
  }
  const r = cfg.impuestoTasa / 100
  if (cfg.impuestoIncluido) {
    const base = neto / (1 + r)
    return { base, iva: neto - base, total: neto, tasa: cfg.impuestoTasa }
  }
  const iva = neto * r
  return { base: neto, iva, total: neto + iva, tasa: cfg.impuestoTasa }
}

// --- Importe a letra (pesos mexicanos) --------------------------------------

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos'
]

function decenas(n: number): string {
  if (n <= 20) return UNIDADES[n]
  if (n < 30) return 'veinti' + UNIDADES[n - 20]
  const d = Math.floor(n / 10)
  const u = n % 10
  return DECENAS[d] + (u ? ' y ' + UNIDADES[u] : '')
}

function centenas(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  return (c ? CENTENAS[c] + (resto ? ' ' : '') : '') + decenas(resto)
}

function enteroALetras(n: number): string {
  if (n === 0) return 'cero'
  let palabras = ''
  const millones = Math.floor(n / 1000000)
  const miles = Math.floor((n % 1000000) / 1000)
  const resto = n % 1000
  if (millones > 0) palabras += (millones === 1 ? 'un millon' : centenas(millones) + ' millones') + ' '
  if (miles > 0) palabras += (miles === 1 ? 'mil' : centenas(miles) + ' mil') + ' '
  if (resto > 0) palabras += centenas(resto)
  return palabras.trim()
}

/** Convierte un importe a letra, ej. "ciento veinte pesos 50/100 M.N." */
export function totalEnLetra(monto: number): string {
  const abs = Math.abs(monto)
  const entero = Math.floor(abs)
  const centavos = Math.round((abs - entero) * 100)
  const palabras = enteroALetras(entero)
  return `${palabras} ${entero === 1 ? 'peso' : 'pesos'} ${String(centavos).padStart(2, '0')}/100 M.N.`
}
