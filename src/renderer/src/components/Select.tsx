import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface OpcionSelect<T> {
  valor: T
  label: string
}

interface Props<T> {
  valor: T
  onChange: (valor: T) => void
  opciones: readonly OpcionSelect<T>[]
  className?: string
  /** Tamaño del control: `md` para formularios, `sm` para celdas compactas. */
  size?: 'md' | 'sm'
  placeholder?: string
  /** Marca el control en ámbar (dato requerido sin elegir). */
  invalido?: boolean
  disabled?: boolean
}

// Dropdown propio (reemplaza al <select> nativo, que en Windows ignora el estilo
// de sus opciones). La lista se renderiza en un portal con posición fija para no
// cortarse dentro de modales o tablas con scroll; se cierra al hacer scroll, al
// hacer clic fuera o con Escape. Soporta teclado (flechas / Enter / Esc).
export function Select<T extends string | number>({
  valor,
  onChange,
  opciones,
  className = '',
  size = 'md',
  placeholder = 'Seleccionar…',
  invalido = false,
  disabled = false
}: Props<T>): React.JSX.Element {
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null)
  const dispararRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)

  const seleccionada = opciones.find((o) => o.valor === valor)

  const calcularPos = (): void => {
    const r = dispararRef.current?.getBoundingClientRect()
    if (!r) return
    const espacioAbajo = window.innerHeight - r.bottom
    const espacioArriba = r.top
    const arriba = espacioAbajo < 260 && espacioArriba > espacioAbajo
    const maxH = Math.min(288, (arriba ? espacioArriba : espacioAbajo) - 16)
    setPos({
      left: r.left,
      width: r.width,
      maxH,
      ...(arriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 })
    })
  }

  const abrir = (): void => {
    if (disabled) return
    calcularPos()
    const i = opciones.findIndex((o) => o.valor === valor)
    setResaltado(i >= 0 ? i : 0)
    setAbierto(true)
  }

  // Cierra al hacer clic fuera (disparador o lista), y al hacer scroll/resize.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent): void => {
      const t = e.target as Node
      if (!dispararRef.current?.contains(t) && !listaRef.current?.contains(t)) setAbierto(false)
    }
    const cerrar = (): void => setAbierto(false)
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto])

  // Mantiene la opción resaltada a la vista al navegar con el teclado.
  useLayoutEffect(() => {
    if (!abierto) return
    const el = listaRef.current?.children[resaltado] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [abierto, resaltado])

  const elegir = (o: OpcionSelect<T>): void => {
    onChange(o.valor)
    setAbierto(false)
    dispararRef.current?.focus()
  }

  const teclado = (e: React.KeyboardEvent): void => {
    if (!abierto) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        abrir()
      }
      return
    }
    if (e.key === 'Escape' || e.key === 'Tab') setAbierto(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((i) => Math.min(opciones.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = opciones[resaltado]
      if (o) elegir(o)
    }
  }

  const alto = size === 'sm' ? 'py-1.5 pl-2.5 pr-2 text-sm' : 'py-2.5 pl-3.5 pr-3 text-base'
  const marco = invalido
    ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
    : 'border-acento/25 bg-acento/[0.05] hover:border-acento/45 hover:bg-acento/[0.08]'

  return (
    <div className={`relative ${className}`}>
      <button
        ref={dispararRef}
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={teclado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border font-medium text-tinta outline-none transition focus:ring-2 focus:ring-acento/20 disabled:cursor-not-allowed disabled:opacity-50 ${alto} ${
          abierto ? 'border-acento bg-superficie ring-2 ring-acento/20' : marco
        } ${size === 'sm' ? 'rounded-lg' : ''}`}
      >
        <span className={`truncate ${seleccionada ? '' : 'text-tinta-suave'}`}>
          {seleccionada ? seleccionada.label : placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0f4c5c"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto &&
        pos &&
        createPortal(
          <ul
            ref={listaRef}
            role="listbox"
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxH
            }}
            className="animar-fundido z-[100] overflow-auto rounded-xl border border-black/[0.08] bg-superficie p-1 shadow-xl"
          >
            {opciones.map((o, i) => {
              const activa = o.valor === valor
              const resalt = i === resaltado
              return (
                <li
                  key={String(o.valor)}
                  role="option"
                  aria-selected={activa}
                  onMouseEnter={() => setResaltado(i)}
                  onClick={() => elegir(o)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activa
                      ? 'bg-acento font-semibold text-white'
                      : resalt
                        ? 'bg-acento/10 text-tinta'
                        : 'text-tinta'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {activa && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </li>
              )
            })}
          </ul>,
          document.body
        )}
    </div>
  )
}
