import type { LogoTicket } from '@shared/types'
// Logo del pie del ticket: incluye "Powered by Olyssea" (por eso el ticket ya no
// imprime esa línea de texto aparte). El login usa el wordmark simple.
import logoAnkyraUrl from '@renderer/assets/ankyra-pie.png'

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

// Logo de marca de Ankyra (el del login) rasterizado para el pie del ticket.
// Se cachea por ancho. Usa <img> con el asset ('self'/data:, permitido por la CSP).
const cacheLogoAnkyra: Record<number, LogoTicket> = {}
export async function logoAnkyra(anchoMaxPuntos: number): Promise<LogoTicket> {
  if (cacheLogoAnkyra[anchoMaxPuntos]) return cacheLogoAnkyra[anchoMaxPuntos]
  const img = await cargarImagen(logoAnkyraUrl)
  const logo = rasterizar(img, img.naturalWidth, img.naturalHeight, anchoMaxPuntos, 320)
  cacheLogoAnkyra[anchoMaxPuntos] = logo
  return logo
}

// Íconos monocromos (negro) de cada red social, en SVG. Se usan para el ticket
// (compuestos con el usuario) y para mostrarlos en Ajustes.
export type RedSocial = 'facebook' | 'instagram'
export const ICONOS_SOCIAL: Record<RedSocial, string> = {
  facebook:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.8 3.8-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
  instagram:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="black" d="M12 4c-2.2 0-2.5 0-3.3.05-.9.04-1.4.2-1.8.35-.45.17-.8.4-1.1.72-.33.32-.55.66-.72 1.1-.15.4-.3.9-.35 1.8C4.7 9.4 4.7 9.7 4.7 12s0 2.6.05 3.4c.04.9.2 1.4.35 1.8.17.45.4.8.72 1.1.32.33.66.55 1.1.72.4.15.9.3 1.8.35C9.5 19.3 9.8 19.3 12 19.3s2.5 0 3.3-.05c.9-.04 1.4-.2 1.8-.35.45-.17.8-.4 1.1-.72.33-.32.55-.66.72-1.1.15-.4.3-.9.35-1.8.05-.8.05-1.1.05-3.4s0-2.6-.05-3.4c-.04-.9-.2-1.4-.35-1.8a2.96 2.96 0 0 0-.72-1.1 2.96 2.96 0 0 0-1.1-.72c-.4-.15-.9-.3-1.8-.35C14.5 4 14.2 4 12 4zm0 1.8c2.1 0 2.4 0 3.3.05.8.03 1.2.18 1.5.3.37.14.64.32.92.6.28.28.46.55.6.92.12.3.27.7.3 1.5.05.9.05 1.2.05 3.3s0 2.4-.05 3.3c-.03.8-.18 1.2-.3 1.5-.14.37-.32.64-.6.92-.28.28-.55.46-.92.6-.3.12-.7.27-1.5.3-.9.05-1.2.05-3.3.05s-2.4 0-3.3-.05c-.8-.03-1.2-.18-1.5-.3a2.5 2.5 0 0 1-.92-.6 2.5 2.5 0 0 1-.6-.92c-.12-.3-.27-.7-.3-1.5C5.8 14.4 5.8 14.1 5.8 12s0-2.4.05-3.3c.03-.8.18-1.2.3-1.5.14-.37.32-.64.6-.92.28-.28.55-.46.92-.6.3-.12.7-.27 1.5-.3.9-.05 1.2-.05 3.3-.05zm0 3a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 6.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4zm4.3-7.1a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>'
}

/** Ícono SVG de una red como data URL, listo para <img> o para dibujar en canvas. */
export function iconoSocialDataUrl(tipo: RedSocial): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONOS_SOCIAL[tipo])
}

// Compone "ícono + usuario" en un solo bitmap para imprimir la red en una línea.
const cacheSocial: Record<string, LogoTicket> = {}
export async function socialALogo(
  tipo: RedSocial,
  texto: string,
  anchoMaxPuntos: number
): Promise<LogoTicket> {
  const clave = `${tipo}|${texto}|${anchoMaxPuntos}`
  if (cacheSocial[clave]) return cacheSocial[clave]
  const icono = await cargarImagen(iconoSocialDataUrl(tipo))
  const H = 46
  const iconoW = 42
  const gap = 12
  const fuente = '600 32px "Inter", system-ui, sans-serif'
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('No se pudo preparar el lienzo')
  medidor.font = fuente
  const tw = Math.ceil(medidor.measureText(texto).width)
  const W = iconoW + gap + tw + 4
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(icono, 0, 3, iconoW, H - 6)
  ctx.fillStyle = '#000'
  ctx.font = fuente
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, iconoW + gap, H / 2 + 1)
  const logo = rasterizar(canvas, W, H, anchoMaxPuntos, 90)
  cacheSocial[clave] = logo
  return logo
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => rechazar(new Error('No se pudo cargar el logo de Ankyra'))
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
