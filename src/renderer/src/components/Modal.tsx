import { useEffect, type ReactNode } from 'react'
import { Icono } from '@renderer/components/Icono'

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  /** Pie del modal, normalmente botones de acción. */
  pie?: ReactNode
  ancho?: string
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  pie,
  ancho = 'max-w-md'
}: Props): React.JSX.Element | null {
  useEffect(() => {
    if (!abierto) return
    const onTecla = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onTecla)
    return () => window.removeEventListener('keydown', onTecla)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className={`w-full ${ancho} rounded-lg border border-slate-200 bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
        {pie && (
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {pie}
          </footer>
        )}
      </div>
    </div>
  )
}
