import type { DetalleOrden, OrdenConDetalle } from '@shared/types'

// Impresión de tickets. Modo simulación: arma el texto del ticket y lo escribe
// en consola. Cuando se integre la impresora térmica (node-thermal-printer),
// se reemplaza el cuerpo de `emitir` por la salida ESC/POS real.

const ANCHO = 32

function linea(car = '-'): string {
  return car.repeat(ANCHO)
}

function fila(izq: string, der: string): string {
  const espacio = Math.max(1, ANCHO - izq.length - der.length)
  return izq + ' '.repeat(espacio) + der
}

function centrar(txt: string): string {
  const pad = Math.max(0, Math.floor((ANCHO - txt.length) / 2))
  return ' '.repeat(pad) + txt
}

function pesos(n: number): string {
  return `$${(n || 0).toFixed(2)}`
}

function emitir(texto: string): string {
  // SIMULACIÓN: en producción aquí va la impresión ESC/POS.
  console.log('\n----- TICKET (simulación) -----\n' + texto + '\n-------------------------------\n')
  return texto
}

export function imprimirCocina(
  titulo: string,
  lineas: DetalleOrden[],
  opciones: { adicional?: boolean; reimpresion?: boolean } = {}
): string {
  const l: string[] = []
  l.push(centrar('*** COCINA ***'))
  if (opciones.adicional) l.push(centrar('*** ADICIONAL ***'))
  if (opciones.reimpresion) l.push(centrar('*** REIMPRESION ***'))
  l.push(linea())
  l.push(fila(titulo, new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })))
  l.push(linea())
  for (const d of lineas) {
    l.push(`${d.cantidad} x ${d.nombreProducto}`)
    for (const m of d.modificadores) l.push(`   + ${m.nombre}`)
    if (d.notas) l.push(`   > ${d.notas}`)
  }
  l.push(linea())
  return emitir(l.join('\n'))
}

export function imprimirFinal(
  titulo: string,
  orden: OrdenConDetalle,
  opciones: { copia?: boolean } = {}
): string {
  const l: string[] = []
  l.push(centrar('HERMES POS'))
  l.push(centrar('Gracias por su visita'))
  if (opciones.copia) l.push(centrar('*** COPIA ***'))
  l.push(linea())
  l.push(fila(titulo, `#${orden.id}`))
  l.push(linea())
  for (const d of orden.detalle) {
    l.push(fila(`${d.cantidad} x ${d.nombreProducto}`, pesos(d.cantidad * d.precioUnitario)))
    for (const m of d.modificadores) l.push(`   + ${m.nombre}`)
  }
  l.push(linea())
  if (orden.descuento > 0) {
    l.push(fila('Subtotal', pesos(orden.total)))
    l.push(fila('Descuento', `-${pesos(orden.descuento)}`))
  }
  const neto = orden.total - orden.descuento
  l.push(fila('TOTAL', pesos(neto)))
  if (orden.metodoPago) {
    l.push(fila(orden.metodoPago, pesos(orden.montoRecibido ?? neto)))
    if (orden.metodoPago === 'efectivo') l.push(fila('Cambio', pesos(orden.cambio ?? 0)))
  }
  l.push(linea())
  return emitir(l.join('\n'))
}
