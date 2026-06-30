import type { LogoTicket } from '@shared/types'
import hermesUrl from '@renderer/assets/hermes-logo.png'

// Convierte un PNG (u otra imagen) a un mapa de bits monocromo en formato
// ESC/POS (GS v 0). Todo ocurre en el renderer porque Chromium ya trae Canvas;
// el main solo emite los bytes resultantes. Se usa difuminado Floyd–Steinberg
// para que fotos y degradados se vean decentes en blanco y negro.

/**
 * Rasteriza un archivo de imagen a `LogoTicket`.
 * @param anchoMaxPuntos Ancho de impresión en puntos (384 para 58 mm, 576 para 80 mm).
 * @param altoMaxPuntos  Tope de alto para que el logo no se coma medio rollo.
 *
 * Se usa `createImageBitmap` (decodifica el Blob directo) en vez de un <img> con
 * `blob:`, porque la CSP del renderer (`img-src 'self' data:`) bloquea blobs.
 */
export async function pngALogo(
  file: File,
  anchoMaxPuntos: number,
  altoMaxPuntos = 320
): Promise<LogoTicket> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('No se pudo leer la imagen (¿es un PNG o JPG válido?)')
  }
  try {
    return rasterizar(bitmap, bitmap.width, bitmap.height, anchoMaxPuntos, altoMaxPuntos)
  } finally {
    bitmap.close()
  }
}

// Logo de marca de Hermes (el del login) rasterizado para el pie del ticket.
// Se cachea por ancho. Usa <img> con el asset ('self'/data:, permitido por la CSP).
const cacheHermes: Record<number, LogoTicket> = {}
export async function logoHermes(anchoMaxPuntos: number): Promise<LogoTicket> {
  if (cacheHermes[anchoMaxPuntos]) return cacheHermes[anchoMaxPuntos]
  const img = await cargarImagen(hermesUrl)
  const logo = rasterizar(img, img.naturalWidth, img.naturalHeight, anchoMaxPuntos, 320)
  cacheHermes[anchoMaxPuntos] = logo
  return logo
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => rechazar(new Error('No se pudo cargar el logo de Hermes'))
    img.src = src
  })
}

// Núcleo de rasterización: recorta al contenido, quita el fondo y difumina a 1 bit.
function rasterizar(
  src: CanvasImageSource,
  wN: number,
  hN: number,
  anchoMaxPuntos: number,
  altoMaxPuntos: number
): LogoTicket {
  if (!wN || !hN) throw new Error('La imagen está vacía')

  {
    // --- Análisis a tamaño capado: detectar fondo y recortar el margen vacío ---
    const aw = Math.min(wN, 1000)
    const ah = Math.max(1, Math.round((aw / wN) * hN))
    const lienzoA = document.createElement('canvas')
    lienzoA.width = aw
    lienzoA.height = ah
    const ctxA = lienzoA.getContext('2d')
    if (!ctxA) throw new Error('No se pudo preparar el lienzo')
    ctxA.fillStyle = '#fff'
    ctxA.fillRect(0, 0, aw, ah)
    ctxA.drawImage(src, 0, 0, aw, ah)
    const datosA = ctxA.getImageData(0, 0, aw, ah).data

    // Color de fondo por las 4 esquinas. Los píxeles parecidos (o transparentes)
    // son "fondo": ni cuentan para el recorte ni se imprimen ("quitar el fondo").
    const esq = [0, aw - 1, (ah - 1) * aw, (ah - 1) * aw + (aw - 1)]
    let fr = 0, fg = 0, fb = 0
    for (const p of esq) {
      fr += datosA[p * 4]
      fg += datosA[p * 4 + 1]
      fb += datosA[p * 4 + 2]
    }
    fr /= 4; fg /= 4; fb /= 4
    const UMBRAL_FONDO = 60 // distancia de color para considerar "fondo"

    const esFondo = (i: number): boolean =>
      datosA[i * 4 + 3] < 32 ||
      Math.hypot(datosA[i * 4] - fr, datosA[i * 4 + 1] - fg, datosA[i * 4 + 2] - fb) < UMBRAL_FONDO

    // Caja del contenido real (recorta los márgenes vacíos arriba/abajo/lados).
    let minX = aw, minY = ah, maxX = -1, maxY = -1
    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        if (!esFondo(y * aw + x)) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < minX || maxY < minY) { minX = 0; minY = 0; maxX = aw - 1; maxY = ah - 1 }

    // Mapea la caja a coordenadas del bitmap original para recortar al escalar.
    const sx = (minX / aw) * wN
    const sy = (minY / ah) * hN
    const sw = ((maxX - minX + 1) / aw) * wN
    const sh = ((maxY - minY + 1) / ah) * hN

    // --- Lienzo final: recorta (sx,sy,sw,sh) y escala al ancho objetivo ---
    let ancho = Math.min(anchoMaxPuntos, Math.round(sw))
    ancho = Math.max(8, Math.floor(ancho / 8) * 8)
    let alto = Math.max(1, Math.round((ancho / sw) * sh))
    if (alto > altoMaxPuntos) {
      ancho = Math.max(8, Math.floor(((altoMaxPuntos / sh) * sw) / 8) * 8)
      alto = Math.max(1, Math.round((ancho / sw) * sh))
    }

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar el lienzo')
    // Fondo blanco: las zonas transparentes del PNG se imprimen como papel.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, ancho, alto)
    const { data } = ctx.getImageData(0, 0, ancho, alto)

    // Luminancia (componiendo sobre blanco según el alfa).
    const gris = new Float32Array(ancho * alto)
    for (let i = 0; i < ancho * alto; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      const a = data[i * 4 + 3]
      // Transparente o parecido al fondo → papel (blanco, no imprime).
      if (a < 32 || Math.hypot(r - fr, g - fg, b - fb) < UMBRAL_FONDO) {
        gris[i] = 255
        continue
      }
      const af = a / 255
      const rr = r * af + 255 * (1 - af)
      const gg = g * af + 255 * (1 - af)
      const bb = b * af + 255 * (1 - af)
      gris[i] = 0.299 * rr + 0.587 * gg + 0.114 * bb
    }

    // Umbral con difuminado Floyd–Steinberg → 1 bit por punto.
    const bytesPorFila = Math.ceil(ancho / 8)
    const out = new Uint8Array(bytesPorFila * alto)
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const idx = y * ancho + x
        const viejo = gris[idx]
        const nuevo = viejo < 128 ? 0 : 255
        const err = viejo - nuevo
        if (x + 1 < ancho) gris[idx + 1] += (err * 7) / 16
        if (y + 1 < alto) {
          if (x > 0) gris[idx + ancho - 1] += (err * 3) / 16
          gris[idx + ancho] += (err * 5) / 16
          if (x + 1 < ancho) gris[idx + ancho + 1] += (err * 1) / 16
        }
        // Punto negro → bit en 1 (MSB primero).
        if (nuevo === 0) out[y * bytesPorFila + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }

    let bin = ''
    for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i])
    return { ancho, alto, datos: btoa(bin) }
  }
}

/** Reconstruye el raster a un data URL PNG para previsualizar cómo se imprimirá. */
export function logoAVistaPrevia(logo: LogoTicket): string {
  const { ancho, alto, datos } = logo
  const bin = atob(datos)
  const bytesPorFila = Math.ceil(ancho / 8)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(ancho, alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const byte = bin.charCodeAt(y * bytesPorFila + (x >> 3))
      const bit = (byte >> (7 - (x & 7))) & 1
      const v = bit ? 0 : 255
      const o = (y * ancho + x) * 4
      img.data[o] = v
      img.data[o + 1] = v
      img.data[o + 2] = v
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}
