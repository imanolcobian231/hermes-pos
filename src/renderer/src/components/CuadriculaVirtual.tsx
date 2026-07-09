import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Props<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyOf: (item: T) => React.Key
  /** Ancho mínimo de cada columna (px); las columnas se calculan según el ancho. */
  minColAncho?: number
  /** Alto fijo de cada tarjeta (px). */
  altoFila?: number
  /** Separación entre tarjetas (px). */
  gap?: number
  vacio?: React.ReactNode
}

// Cuadrícula virtualizada: solo renderiza las filas visibles (las tarjetas en
// pantalla), no todos los productos de golpe. Calcula las columnas según el
// ancho disponible y usa @tanstack/react-virtual sobre las filas.
export function CuadriculaVirtual<T>({
  items,
  renderItem,
  keyOf,
  minColAncho = 160,
  altoFila = 96,
  gap = 12,
  vacio
}: Props<T>): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setAncho(el.clientWidth)
    const ro = new ResizeObserver((entries) => setAncho(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = Math.max(1, Math.floor((ancho + gap) / (minColAncho + gap)))
  const numFilas = Math.ceil(items.length / cols)

  const v = useVirtualizer({
    count: numFilas,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => altoFila + gap,
    overscan: 4
  })

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pr-1">
      {items.length === 0 ? (
        (vacio ?? null)
      ) : (
        <div style={{ height: v.getTotalSize(), position: 'relative', width: '100%' }}>
          {v.getVirtualItems().map((vr) => {
            const inicio = vr.index * cols
            const fila = items.slice(inicio, inicio + cols)
            return (
              <div
                key={vr.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vr.start}px)`,
                  height: altoFila,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap
                }}
              >
                {fila.map((item) => (
                  <div key={keyOf(item)} style={{ height: altoFila }}>
                    {renderItem(item)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
