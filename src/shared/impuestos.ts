// Cálculo de impuestos (IVA) y conversión de importe a letra. Compartido entre
// el proceso main (tickets) y el renderer (Cobro / vista previa).

export interface ConfigImpuesto {
  impuestoActivo: boolean
  /** Tasa en porcentaje, ej. 16 para IVA 16% (respaldo si no hay lista). */
  impuestoTasa: number
  /** true = los precios YA incluyen el impuesto; false = se agrega al total. */
  impuestoIncluido: boolean
  /** Impuestos personalizados (nombre + tasa). Si está vacío, se usa impuestoTasa. */
  impuestos?: { nombre: string; tasa: number }[]
}

export interface DesgloseImpuesto {
  /** Importe sin impuesto. */
  base: number
  /** Monto total del impuesto (suma de todos). */
  iva: number
  /** Total a pagar (base + impuestos, o el mismo neto si van incluidos). */
  total: number
  /** Tasa total aplicada (%). 0 si no hay impuesto. */
  tasa: number
  /** Desglose por impuesto (nombre, tasa, monto). */
  lineas: { nombre: string; tasa: number; monto: number }[]
}

/** Desglosa los impuestos a partir del neto (total de líneas menos descuento). */
export function calcularImpuesto(neto: number, cfg: ConfigImpuesto): DesgloseImpuesto {
  const vacio: DesgloseImpuesto = { base: neto, iva: 0, total: neto, tasa: 0, lineas: [] }
  if (!cfg.impuestoActivo) return vacio
  // Lista efectiva: los personalizados, o el IVA único como respaldo.
  const lista = (
    cfg.impuestos && cfg.impuestos.length > 0
      ? cfg.impuestos
      : cfg.impuestoTasa > 0
        ? [{ nombre: 'IVA', tasa: cfg.impuestoTasa }]
        : []
  ).filter((i) => i.tasa > 0)
  if (lista.length === 0) return vacio

  const tasaTotal = lista.reduce((s, i) => s + i.tasa, 0)
  const r = tasaTotal / 100
  // Precios con impuesto incluido: la base se extrae del neto; si no, se suma.
  const base = cfg.impuestoIncluido ? neto / (1 + r) : neto
  const total = cfg.impuestoIncluido ? neto : neto + neto * r
  const iva = total - base
  // Reparte el impuesto por tasa (base × tasa). La suma da el iva total.
  const lineas = lista.map((i) => ({ nombre: i.nombre, tasa: i.tasa, monto: base * (i.tasa / 100) }))
  return { base, iva, total, tasa: tasaTotal, lineas }
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
