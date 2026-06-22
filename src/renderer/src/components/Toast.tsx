import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

type TipoToast = 'exito' | 'error' | 'info'

interface ItemToast {
  id: number
  mensaje: string
  tipo: TipoToast
}

const estilos: Record<TipoToast, { fondo: string; icono: NombreIcono }> = {
  exito: { fondo: 'bg-slate-900', icono: 'check' },
  error: { fondo: 'bg-red-700', icono: 'alerta' },
  info: { fondo: 'bg-slate-900', icono: 'info' }
}

type FnToast = (mensaje: string, tipo?: TipoToast) => void

const ToastContext = createContext<FnToast>(() => {})

export function ProveedorToast({ children }: { children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ItemToast[]>([])

  const toast = useCallback<FnToast>((mensaje, tipo = 'exito') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, mensaje, tipo }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${estilos[t.tipo].fondo}`}
          >
            <Icono nombre={estilos[t.tipo].icono} size={16} />
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): FnToast {
  return useContext(ToastContext)
}
