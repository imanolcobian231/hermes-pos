import iconv from 'iconv-lite'
import type { DestinoImpresion, DetalleOrden, OrdenConDetalle } from '@shared/types'
import { calcularImpuesto, totalEnLetra } from '@shared/impuestos'
import { agruparLineas } from '@shared/ticket'
import { obtenerImpresoras } from '../repos/config'

// Armado de tickets térmicos (ESC/POS). El texto se compone al ancho configurado
// (32 columnas para 58 mm, 48 para 80 mm) y se convierte a un buffer ESC/POS. El
// TRANSPORTE (enviar a la impresora) lo hace el renderer por Web Bluetooth.

interface Formato {
  linea: (car?: string) => string
  fila: (izq: string, der: string) => string
  centrar: (txt: string) => string
}

// Crea los ayudantes de formato para un ancho dado (número de columnas).
function formato(ancho: number): Formato {
  return {
    linea: (car = '-') => car.repeat(ancho),
    fila: (izq, der) => {
      const espacio = Math.max(1, ancho - izq.length - der.length)
      return izq + ' '.repeat(espacio) + der
    },
    centrar: (txt) => {
      const pad = Math.max(0, Math.floor((ancho - txt.length) / 2))
      return ' '.repeat(pad) + txt
    }
  }
}

function pesos(n: number): string {
  return `$${(n || 0).toFixed(2)}`
}

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
}

// Divide un texto en líneas que no excedan `ancho` columnas (corta por palabras;
// si una palabra es más larga que el ancho, la parte). Evita que se desborde.
function envolver(texto: string, ancho: number): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    let p = palabra
    while (p.length > ancho) {
      if (actual) {
        lineas.push(actual)
        actual = ''
      }
      lineas.push(p.slice(0, ancho))
      p = p.slice(ancho)
    }
    if (!actual) actual = p
    else if (actual.length + 1 + p.length <= ancho) actual += ' ' + p
    else {
      lineas.push(actual)
      actual = p
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

// Fecha y hora legibles (ej. "23/06/2026 13:45"). Usa la fecha dada o la actual.
function fechaHora(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// --- Salida ESC/POS ----------------------------------------------------------

const ESC = 0x1b
const GS = 0x1d

// Un bloque del ticket; cada uno puede ir en tamaño normal o doble (grande).
interface Segmento {
  texto: string
  grande?: boolean
}

/** Convierte los segmentos del ticket en bytes ESC/POS listos para la térmica. */
function construirEscPos(
  segmentos: Segmento[],
  opc: { cortar: boolean; cajon: boolean; avance: number }
): number[] {
  const trozos: Buffer[] = []
  trozos.push(Buffer.from([ESC, 0x40])) // ESC @  — inicializar impresora
  trozos.push(Buffer.from([ESC, 0x4d, 0x00])) // ESC M 0 — Fuente A (misma letra en ambas impresoras)
  trozos.push(Buffer.from([ESC, 0x74, 0x02])) // ESC t 2 — code page PC850 (acentos ES)
  for (const seg of segmentos) {
    if (!seg.texto) continue
    if (seg.grande) trozos.push(Buffer.from([GS, 0x21, 0x11])) // GS ! — doble ancho y alto
    trozos.push(iconv.encode(seg.texto.replace(/\r?\n/g, '\r\n') + '\r\n', 'cp850'))
    if (seg.grande) trozos.push(Buffer.from([GS, 0x21, 0x00])) // restablece tamaño normal
  }
  // Avance de papel al final (para arrancar el ticket). Acotado a 0..20 líneas.
  // Se usa `ESC d n` (imprime y avanza n líneas), que es más compatible que
  // mandar saltos de línea sueltos (algunas térmicas BLE los ignoran al final).
  const avance = Math.max(0, Math.min(Math.round(opc.avance), 20))
  if (avance > 0) trozos.push(Buffer.from([ESC, 0x64, avance])) // ESC d n
  if (opc.cajon) trozos.push(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa])) // pulso al cajón
  if (opc.cortar) trozos.push(Buffer.from([GS, 0x56, 0x42, 0x00])) // GS V B 0 — corte total
  return [...Buffer.concat(trozos)]
}

/** Aplica las opciones de la config (cortar/cajón/avance) y devuelve los bytes. */
function aBytes(segmentos: Segmento[], opc: { cajon?: boolean } = {}): number[] {
  const cfg = obtenerImpresoras()
  return construirEscPos(segmentos, {
    cortar: cfg.cortarPapel,
    cajon: !!opc.cajon && cfg.abrirCajon,
    avance: cfg.avanceFinal
  })
}

// --- Tickets (devuelven bytes ESC/POS) --------------------------------------

export function bytesCocina(
  titulo: string,
  lineas: DetalleOrden[],
  opciones: { adicional?: boolean; reimpresion?: boolean } = {}
): number[] {
  const cfg = obtenerImpresoras()
  const grande = cfg.cocinaGrande
  // Con letra doble caben la mitad de columnas, así que se formatea a ancho/2.
  const columnas = grande ? Math.max(16, Math.floor(cfg.ancho / 2)) : cfg.ancho
  const { linea, fila, centrar } = formato(columnas)
  const l: string[] = []
  l.push(centrar('*** COCINA ***'))
  if (opciones.adicional) l.push(centrar('*** ADICIONAL ***'))
  if (opciones.reimpresion) l.push(centrar('*** REIMPRESION ***'))
  l.push(linea())
  l.push(fila(titulo, new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })))
  l.push(linea())
  const grupos = new Map<number, DetalleOrden[]>()
  for (const d of lineas) {
    const c = d.comensal ?? 1
    if (!grupos.has(c)) grupos.set(c, [])
    grupos.get(c)!.push(d)
  }
  const variosComensales = grupos.size > 1
  for (const [comensal, items] of [...grupos.entries()].sort((a, b) => a[0] - b[0])) {
    if (variosComensales) l.push(centrar(`- COMENSAL ${comensal} -`))
    for (const d of items) {
      l.push(`${d.cantidad} x ${d.nombreProducto}`)
      for (const m of d.modificadores) l.push(`   + ${m.nombre}`)
      if (d.notas) l.push(`   > ${d.notas}`)
    }
  }
  l.push(linea())
  return aBytes([{ texto: l.join('\n'), grande }])
}

export function bytesFinal(
  titulo: string,
  orden: OrdenConDetalle,
  opciones: { copia?: boolean } = {}
): number[] {
  const cfg = obtenerImpresoras()
  const { linea, fila, centrar } = formato(cfg.ancho)
  // Para texto a doble tamaño se usa la mitad de columnas.
  const fmtMitad = formato(Math.max(8, Math.floor(cfg.ancho / 2)))
  const neto = orden.total - orden.descuento
  const imp = calcularImpuesto(neto, cfg)

  // --- Cuerpo (tamaño normal): encabezado, productos y desglose. ---
  // Una línea en blanco separa cada bloque; arriba/abajo lleva margen.
  const cabeza: string[] = ['', '']
  const centrarEnvuelto = (txt: string): void => {
    for (const ln of envolver(txt, cfg.ancho)) cabeza.push(centrar(ln))
  }
  if (cfg.nombreNegocio) centrarEnvuelto(cfg.nombreNegocio)
  if (cfg.direccion) centrarEnvuelto(cfg.direccion)
  if (cfg.telefono) centrarEnvuelto(`Tel: ${cfg.telefono}`)
  cabeza.push('')
  cabeza.push(centrar('Gracias por su visita'))
  if (opciones.copia) cabeza.push(centrar('*** COPIA ***'))
  cabeza.push('')
  cabeza.push(linea())
  cabeza.push(fila(titulo, `Ticket #${orden.id}`))
  cabeza.push(fechaHora(orden.cerradoEn))
  cabeza.push(linea())
  cabeza.push('')
  // Productos agrupados (sin separar por comensal) para el ticket del cliente.
  for (const d of agruparLineas(orden.detalle)) {
    cabeza.push(fila(`${d.cantidad} x ${d.nombreProducto}`, pesos(d.cantidad * d.precioUnitario)))
    for (const m of d.modificadores) cabeza.push(`   + ${m.nombre}`)
  }
  cabeza.push('')
  cabeza.push(linea())
  if (orden.descuento > 0) {
    cabeza.push(fila('Importe', pesos(orden.total)))
    cabeza.push(fila('Descuento', `-${pesos(orden.descuento)}`))
  }
  if (imp.tasa > 0) {
    cabeza.push(fila('Subtotal', pesos(imp.base)))
    cabeza.push(fila(`IVA ${imp.tasa}%`, pesos(imp.iva)))
  }
  cabeza.push('') // margen antes del TOTAL

  // --- Pie (tamaño normal): total en letra (alineado a la izquierda) y pago. ---
  const cola: string[] = ['']
  for (const ln of envolver(`Son ${totalEnLetra(imp.total)}`, cfg.ancho)) cola.push(ln)
  cola.push('')
  const pagos = orden.pagos ?? []
  if (pagos.length > 0) {
    // Desglose de pagos (uno por método; varios = pago mixto).
    for (const p of pagos) cola.push(fila(ETIQUETA_METODO[p.metodo] ?? p.metodo, pesos(p.monto)))
    if (orden.cambio && orden.cambio > 0) cola.push(fila('Cambio', pesos(orden.cambio)))
  } else if (orden.metodoPago === 'credito') {
    cola.push(fila('CREDITO (fiado)', pesos(imp.total)))
  } else if (orden.metodoPago && orden.metodoPago !== 'mixto') {
    // Compatibilidad con órdenes antiguas sin desglose de pagos.
    const metodoCap = orden.metodoPago.charAt(0).toUpperCase() + orden.metodoPago.slice(1)
    cola.push(fila(metodoCap, pesos(orden.montoRecibido ?? imp.total)))
    if (orden.metodoPago === 'efectivo') cola.push(fila('Cambio', pesos(orden.cambio ?? 0)))
  }
  cola.push('')
  cola.push(linea())

  // El ticket de caja abre el cajón (si está habilitado), salvo en copias.
  // El TOTAL y "Hermes" van en letra doble. Al final, margen inferior.
  return aBytes(
    [
      { texto: cabeza.join('\n') },
      { texto: fmtMitad.fila('TOTAL', pesos(imp.total)), grande: true },
      { texto: cola.join('\n') },
      { texto: fmtMitad.centrar('Hermes'), grande: true },
      { texto: centrar('Powered by Olyssea') },
      { texto: '\n' }
    ],
    { cajon: !opciones.copia }
  )
}

/**
 * Ticket de prueba para Ajustes: genera una VENTA de ejemplo para ver cómo se
 * vería el ticket real (en cocina imprime una comanda de ejemplo).
 */
export function bytesPrueba(destino: DestinoImpresion): number[] {
  const ahora = new Date().toISOString()
  const detalle: DetalleOrden[] = [
    {
      id: 1, ordenId: 0, productoId: 0, nombreProducto: 'Taco al pastor', cantidad: 3,
      precioUnitario: 25, comensal: 1, enviadoCocina: true, modificadores: []
    },
    {
      id: 2, ordenId: 0, productoId: 0, nombreProducto: 'Quesadilla', cantidad: 1,
      precioUnitario: 45, comensal: 1, enviadoCocina: true,
      modificadores: [{ id: 1, detalleId: 2, modificadorId: null, nombre: 'Sin cebolla', precio: 0 }]
    },
    {
      id: 3, ordenId: 0, productoId: 0, nombreProducto: 'Refresco', cantidad: 2,
      precioUnitario: 25, comensal: 1, enviadoCocina: true, modificadores: []
    }
  ]

  if (destino === 'cocina') {
    return bytesCocina('Mesa 5 (PRUEBA)', detalle)
  }

  const total = detalle.reduce((s, d) => s + d.cantidad * d.precioUnitario, 0)
  const aPagar = calcularImpuesto(total, obtenerImpresoras()).total
  const montoRecibido = Math.ceil((aPagar + 1) / 50) * 50
  const orden: OrdenConDetalle = {
    id: 0,
    mesaId: 5,
    paraLlevar: false,
    estado: 'cobrada',
    total,
    descuento: 0,
    porCobrar: false,
    metodoPago: 'efectivo',
    montoRecibido,
    cambio: montoRecibido - aPagar,
    ticketImpreso: true,
    abiertoEn: ahora,
    cerradoEn: ahora,
    detalle
  }
  return bytesFinal('Mesa 5 (PRUEBA)', orden)
}
