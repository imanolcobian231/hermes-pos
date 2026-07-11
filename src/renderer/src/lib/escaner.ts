import { useEffect, useRef } from 'react'

/**
 * Escucha un lector de código de barras USB (modo teclado): teclea el código
 * muy rápido y termina con Enter. Se detecta la ráfaga veloz (teclas seguidas
 * en < 80 ms) y, al Enter, se entrega el código. El tecleo humano es más lento,
 * así que no dispara el escaneo y no interfiere con escribir en los campos.
 *
 * `activo=false` lo apaga (p. ej. mientras hay un modal abierto).
 */
export function useEscaner(onCodigo: (codigo: string) => void, activo = true): void {
  const cb = useRef(onCodigo)
  cb.current = onCodigo
  useEffect(() => {
    if (!activo) return
    let buffer = ''
    let ultima = 0
    const onKey = (e: KeyboardEvent): void => {
      const ahora = Date.now()
      if (ahora - ultima > 80) buffer = '' // pausa larga = tecleo humano, reinicia
      ultima = ahora
      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault()
          cb.current(buffer)
        }
        buffer = ''
        return
      }
      if (e.key.length === 1) buffer += e.key
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activo])
}
