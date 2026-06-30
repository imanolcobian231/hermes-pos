import iconv from 'iconv-lite'
import type { Corte, DestinoImpresion, DetalleOrden, LogoTicket, OrdenConDetalle } from '@shared/types'
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

// Envuelve `texto` al ancho disponible tras un prefijo (ej. "3 x ", "   + ") y
// alinea las continuaciones bajo el texto. Evita que los nombres largos se
// desborden en papel angosto (58 mm), sobre todo con letra grande.
function lineasEnvueltas(prefijo: string, texto: string, ancho: number): string[] {
  const sangria = ' '.repeat(prefijo.length)
  const disp = Math.max(4, ancho - prefijo.length)
  const partes = envolver(texto, disp)
  if (partes.length === 0) return [prefijo.trimEnd()]
  return partes.map((p, i) => (i === 0 ? prefijo + p : sangria + p))
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
// `bytes` permite emitir datos ESC/POS crudos (ej. una imagen), que se centran.
interface Segmento {
  texto?: string
  grande?: boolean
  bytes?: number[]
}

/**
 * Construye un segmento de imagen ESC/POS (GS v 0) a partir de un raster
 * monocromo. Se manda en bandas para no saturar impresoras económicas.
 */
function segmentoImagen(logo: LogoTicket): Segmento {
  const { ancho, alto } = logo
  const bytesPorFila = Math.ceil(ancho / 8)
  const datos = Buffer.from(logo.datos, 'base64')
  const xL = bytesPorFila & 0xff
  const xH = (bytesPorFila >> 8) & 0xff
  const ALTURA_BANDA = 128
  const bytes: number[] = []
  for (let y = 0; y < alto; y += ALTURA_BANDA) {
    const h = Math.min(ALTURA_BANDA, alto - y)
    const inicio = y * bytesPorFila
    const trozo = datos.subarray(inicio, inicio + h * bytesPorFila)
    // GS v 0 m xL xH yL yH d... (m=0 normal)
    bytes.push(GS, 0x76, 0x30, 0x00, xL, xH, h & 0xff, (h >> 8) & 0xff, ...trozo)
  }
  return { bytes }
}

/** Segmento del logo del NEGOCIO (desde la config), o null si no hay. */
function segmentoLogo(): Segmento | null {
  const { logoTicket } = obtenerImpresoras()
  return logoTicket?.datos ? segmentoImagen(logoTicket) : null
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
    if (seg.bytes && seg.bytes.length) {
      trozos.push(Buffer.from([ESC, 0x61, 0x01])) // ESC a 1 — centrar
      trozos.push(Buffer.from(seg.bytes))
      trozos.push(Buffer.from([ESC, 0x61, 0x00, 0x0a])) // ESC a 0 — izquierda + avance
      continue
    }
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
  opciones: {
    adicional?: boolean
    reimpresion?: boolean
    cancelacion?: boolean
    area?: 'cocina' | 'barra'
  } = {},
  ancho?: number
): number[] {
  const cfg = obtenerImpresoras()
  const w = ancho ?? cfg.ancho
  const grande = cfg.cocinaGrande
  // Con letra doble caben la mitad de columnas, así que se formatea a ancho/2.
  const columnas = grande ? Math.max(16, Math.floor(w / 2)) : w
  const { linea, fila, centrar } = formato(columnas)
  const l: string[] = []
  // Encabezado: corrección, o el área (BARRA/COCINA) de esta comanda.
  const banner = opciones.cancelacion
    ? '*** CORRECCION ***'
    : opciones.area === 'barra'
      ? '*** BARRA ***'
      : '*** COCINA ***'
  l.push(centrar(banner))
  if (opciones.adicional) l.push(centrar('*** ADICIONAL ***'))
  if (opciones.reimpresion) l.push(centrar('*** REIMPRESION ***'))
  l.push(linea())
  // Título (mesa) y hora. Si caben juntos van en una línea; si no, el título se
  // muestra completo (envuelto) y la hora baja a su propio renglón.
  const horaImp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (titulo.length + 1 + horaImp.length <= columnas) {
    l.push(fila(titulo, horaImp))
  } else {
    for (const ln of envolver(titulo, columnas)) l.push(ln)
    l.push(horaImp)
  }
  l.push(linea())
  // Cada línea se envuelve al ancho de la impresora (no se desborda).
  const pushItem = (d: DetalleOrden): void => {
    l.push(...lineasEnvueltas(`${d.cantidad} x `, d.nombreProducto, columnas))
    for (const m of d.modificadores) l.push(...lineasEnvueltas('   + ', m.nombre, columnas))
    if (d.notas) l.push(...lineasEnvueltas('   > ', d.notas, columnas))
  }
  // La barra no separa por comensal (bebidas); en cocina lo decide el ajuste.
  const separarComensales = opciones.area !== 'barra' && cfg.separarComensales !== false
  if (separarComensales) {
    // Agrupado por comensal con encabezados (si hay más de uno).
    const grupos = new Map<number, DetalleOrden[]>()
    for (const d of lineas) {
      const c = d.comensal ?? 1
      if (!grupos.has(c)) grupos.set(c, [])
      grupos.get(c)!.push(d)
    }
    const variosComensales = grupos.size > 1
    for (const [comensal, items] of [...grupos.entries()].sort((a, b) => a[0] - b[0])) {
      if (variosComensales) l.push(centrar(`- COMENSAL ${comensal} -`))
      for (const d of items) pushItem(d)
    }
  } else {
    // Lista simple, sin separar por comensal.
    for (const d of lineas) pushItem(d)
  }
  l.push(linea())
  return aBytes([{ texto: l.join('\n'), grande }])
}

export function bytesFinal(
  titulo: string,
  orden: OrdenConDetalle,
  opciones: { copia?: boolean } = {},
  ancho?: number,
  logoPie?: LogoTicket | null
): number[] {
  const cfg = obtenerImpresoras()
  const w = ancho ?? cfg.ancho
  const { linea, fila, centrar } = formato(w)
  // Para texto a doble tamaño se usa la mitad de columnas.
  const fmtMitad = formato(Math.max(8, Math.floor(w / 2)))
  const neto = orden.total - orden.descuento
  const imp = calcularImpuesto(neto, cfg)

  // --- Cuerpo (tamaño normal): encabezado, productos y desglose. ---
  // Con logo arriba no hace falta margen superior (el logo ya separa); sin logo,
  // se dejan dos líneas en blanco de respiro.
  const logo = segmentoLogo()
  const cabeza: string[] = logo ? [] : ['', '']
  const centrarEnvuelto = (txt: string): void => {
    for (const ln of envolver(txt, w)) cabeza.push(centrar(ln))
  }
  if (cfg.nombreNegocio) centrarEnvuelto(cfg.nombreNegocio)
  // Cada renglón de la dirección (separado por salto de línea) va en su propia línea.
  if (cfg.direccion) for (const ln of cfg.direccion.split('\n')) if (ln.trim()) centrarEnvuelto(ln.trim())
  if (cfg.telefono) centrarEnvuelto(`Tel: ${cfg.telefono}`)
  if (cfg.rfc) centrarEnvuelto(`RFC: ${cfg.rfc}`)
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
      ...(logo ? [logo] : []),
      { texto: cabeza.join('\n') },
      { texto: fmtMitad.fila('TOTAL', pesos(imp.total)), grande: true },
      { texto: cola.join('\n') },
      { texto: '\n' },
      // Pie de marca Hermes: logo si se proporcionó, si no el texto.
      logoPie ? segmentoImagen(logoPie) : { texto: fmtMitad.centrar('Hermes'), grande: true },
      { texto: centrar('Powered by Olyssea') },
      { texto: '\n' }
    ],
    { cajon: !opciones.copia }
  )
}

/**
 * Ticket del corte de caja: resumen del turno (ventas por método, gastos,
 * balance) y el cuadre de efectivo (fondo, esperado, contado y diferencia).
 * Se imprime en la impresora de Caja al cerrar el turno o al reimprimir.
 */
export function bytesCorte(corte: Corte, ancho?: number): number[] {
  const cfg = obtenerImpresoras()
  const w = ancho ?? cfg.ancho
  const { linea, fila, centrar } = formato(w)
  const fmtMitad = formato(Math.max(8, Math.floor(w / 2)))
  const ventas = corte.totalEfectivo + corte.totalTarjeta + corte.totalTransferencia
  const balance = ventas - corte.totalGastos
  const esperado = corte.fondoInicial + corte.totalEfectivo - corte.totalGastos

  const l: string[] = ['', '']
  if (cfg.nombreNegocio) for (const ln of envolver(cfg.nombreNegocio, w)) l.push(centrar(ln))
  l.push(centrar('CORTE DE CAJA'))
  l.push('')
  l.push(fechaHora(corte.cerradoEn))
  l.push(fila('Ordenes cobradas', String(corte.numOrdenes)))
  l.push(linea())

  // Ventas por método de pago.
  l.push(fila('Efectivo', pesos(corte.totalEfectivo)))
  l.push(fila('Tarjeta', pesos(corte.totalTarjeta)))
  l.push(fila('Transferencia', pesos(corte.totalTransferencia)))
  l.push(linea())
  l.push(fila('Ventas', pesos(ventas)))
  if (corte.totalGastos > 0) l.push(fila('Gastos', `-${pesos(corte.totalGastos)}`))
  l.push('')

  // Cuadre de efectivo en el cajón.
  l.push(centrar('-- Cuadre de efectivo --'))
  l.push(fila('Fondo inicial', pesos(corte.fondoInicial)))
  l.push(fila('Ventas efectivo', pesos(corte.totalEfectivo)))
  if (corte.totalGastos > 0) l.push(fila('Gastos', `-${pesos(corte.totalGastos)}`))
  l.push(fila('Esperado en cajon', pesos(esperado)))
  if (corte.efectivoContado != null) {
    l.push(fila('Efectivo contado', pesos(corte.efectivoContado)))
    const dif = corte.diferencia ?? 0
    if (Math.abs(dif) < 0.01) l.push(fila('Resultado', 'Cuadra'))
    else l.push(fila(dif < 0 ? 'Faltante' : 'Sobrante', `${dif < 0 ? '-' : '+'}${pesos(Math.abs(dif))}`))
  }
  l.push('')
  l.push(linea())

  return aBytes([
    { texto: l.join('\n') },
    { texto: fmtMitad.fila('BALANCE', pesos(balance)), grande: true },
    { texto: '' },
    { texto: centrar('Powered by Olyssea') },
    { texto: '\n' }
  ])
}

/**
 * Ticket de prueba para Ajustes: genera una VENTA de ejemplo para ver cómo se
 * vería el ticket real (en cocina imprime una comanda de ejemplo).
 */
export function bytesPrueba(destino: DestinoImpresion, ancho?: number, logoPie?: LogoTicket | null): number[] {
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
    return bytesCocina('Mesa 5 (PRUEBA)', detalle, {}, ancho)
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
  return bytesFinal('Mesa 5 (PRUEBA)', orden, {}, ancho, logoPie)
}
