import * as XLSX from 'xlsx'
import type { FilaImportProducto } from '@shared/types'

// Importación de productos desde Excel (.xlsx) o CSV con MAPEO de columnas:
// se leen las columnas del archivo y el usuario relaciona cada campo del
// producto (nombre, precio, etc.) con la columna que corresponda.

export type CampoProducto =
  | 'nombre'
  | 'precio'
  | 'categoria'
  | 'costo'
  | 'stock'
  | 'stockMinimo'
  | 'controlarStock'

/** Mapeo campo del producto → nombre de columna del archivo (null = sin mapear). */
export type MapeoColumnas = Record<CampoProducto, string | null>

export interface ArchivoProductos {
  /** Encabezados de columna detectados en el archivo. */
  columnas: string[]
  /** Filas crudas (objeto por fila, con la clave = encabezado original). */
  filas: Record<string, unknown>[]
}

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0)
      return code < 0x300 || code > 0x36f
    })
    .join('')
    .trim()
    .toLowerCase()

const esSi = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  return ['si', 'sí', 'yes', 'true', '1', 'x', 'verdadero'].includes(norm(String(v ?? '')))
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  const n = parseFloat(
    String(v ?? '')
      .replace(/[^0-9.,-]/g, '')
      .replace(',', '.')
  )
  return isNaN(n) ? 0 : n
}

/** Lee el archivo (primera hoja). Toma la primera fila como encabezados; las
 *  celdas de encabezado vacías se nombran "Columna N" y las columnas totalmente
 *  vacías se descartan (evita los "__EMPTY" de SheetJS). */
export async function leerArchivo(file: File): Promise<ArchivoProductos> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { columnas: [], filas: [] }
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  if (aoa.length === 0) return { columnas: [], filas: [] }

  const encabezados = aoa[0]
  const datos = aoa.slice(1)
  const usadas = new Set<string>()
  // Nombre limpio y único por columna.
  const nombres = encabezados.map((h, i) => {
    const base = String(h ?? '').trim() || `Columna ${i + 1}`
    let nombre = base
    let k = 2
    while (usadas.has(nombre)) nombre = `${base} (${k++})`
    usadas.add(nombre)
    return nombre
  })
  // Conserva columnas con encabezado o con algún dato.
  const indices = nombres
    .map((_, i) => i)
    .filter(
      (i) =>
        String(encabezados[i] ?? '').trim() !== '' ||
        datos.some((r) => String(r[i] ?? '').trim() !== '')
    )

  const columnas = indices.map((i) => nombres[i])
  const filas = datos.map((r) => {
    const obj: Record<string, unknown> = {}
    for (const i of indices) obj[nombres[i]] = r[i]
    return obj
  })
  return { columnas, filas }
}

// Alias para adivinar el mapeo automáticamente a partir de los encabezados.
const ALIAS: Record<CampoProducto, string[]> = {
  nombre: ['nombre', 'producto', 'nombre producto', 'nombre del producto', 'descripcion producto'],
  precio: ['precio', 'precio venta', 'precio de venta', 'venta', 'pvp', 'precio publico'],
  categoria: ['categoria', 'familia', 'grupo', 'linea', 'departamento'],
  costo: ['costo', 'costo compra', 'compra', 'costo unitario'],
  stock: ['stock', 'existencia', 'existencias', 'cantidad', 'inventario inicial'],
  stockMinimo: ['stock minimo', 'stockminimo', 'minimo', 'min', 'stock min'],
  controlarStock: ['controlar inventario', 'controlar stock', 'inventario', 'controla', 'controla stock']
}

/** Adivina un mapeo por defecto comparando los encabezados con los alias. */
export function sugerirMapeo(columnas: string[]): MapeoColumnas {
  const campos = Object.keys(ALIAS) as CampoProducto[]
  const mapeo = {} as MapeoColumnas
  for (const campo of campos) {
    const col = columnas.find((c) => ALIAS[campo].includes(norm(c)))
    mapeo[campo] = col ?? null
  }
  return mapeo
}

/** Convierte las filas crudas a productos según el mapeo elegido. */
export function mapearFilas(
  filas: Record<string, unknown>[],
  mapeo: MapeoColumnas
): FilaImportProducto[] {
  const val = (row: Record<string, unknown>, campo: CampoProducto): unknown => {
    const col = mapeo[campo]
    return col ? row[col] : undefined
  }
  return filas
    .map((row) => ({
      nombre: String(val(row, 'nombre') ?? '').trim(),
      precio: num(val(row, 'precio')),
      categoria: String(val(row, 'categoria') ?? '').trim(),
      costo: num(val(row, 'costo')),
      stock: num(val(row, 'stock')),
      stockMinimo: num(val(row, 'stockMinimo')),
      controlarStock: esSi(val(row, 'controlarStock'))
    }))
    .filter((f) => f.nombre.length > 0 || f.categoria.length > 0)
}
