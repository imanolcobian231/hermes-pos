import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { Modal } from '@renderer/components/Modal'

// Autorización de administrador para acciones sensibles (cancelar, devolver,
// aplicar descuentos). Si el usuario en sesión es admin, la acción procede
// directo; si no, pide el PIN de algún administrador para autorizar.

interface AutorizacionContextValue {
  /** Ejecuta `accion` si hay autorización (admin en sesión o PIN correcto). */
  pedir: (accion: () => void, motivo?: string) => void
}

const AutorizacionContext = createContext<AutorizacionContextValue | null>(null)

export function ProveedorAutorizacion({ children }: { children: ReactNode }): React.JSX.Element {
  const { esAdmin } = useAuth()
  const [pendiente, setPendiente] = useState<(() => void) | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const pedir = (accion: () => void, m?: string): void => {
    if (esAdmin) {
      accion()
      return
    }
    setMotivo(m ?? 'Esta acción requiere autorización')
    setPin('')
    setError(false)
    setPendiente(() => accion)
  }

  const confirmar = async (): Promise<void> => {
    const ok = await window.api.usuarios.verificarPinAdmin(pin)
    if (!ok) {
      setError(true)
      return
    }
    const accion = pendiente
    setPendiente(null)
    setPin('')
    accion?.()
  }

  const cerrar = (): void => {
    setPendiente(null)
    setPin('')
    setError(false)
  }

  return (
    <AutorizacionContext.Provider value={{ pedir }}>
      {children}
      <Modal
        abierto={pendiente !== null}
        titulo="Autorización de administrador"
        onCerrar={cerrar}
        pie={
          <>
            <button
              onClick={cerrar}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={() => void confirmar()}
              disabled={!pin}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Autorizar
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{motivo}. Ingresa el PIN de un administrador.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          autoFocus
          onChange={(e) => {
            setPin(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && pin && void confirmar()}
          placeholder="PIN de administrador"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {error && <p className="mt-2 text-sm font-medium text-red-600">PIN incorrecto.</p>}
      </Modal>
    </AutorizacionContext.Provider>
  )
}

export function useAutorizacion(): AutorizacionContextValue {
  const ctx = useContext(AutorizacionContext)
  if (!ctx) throw new Error('useAutorizacion debe usarse dentro de <ProveedorAutorizacion>')
  return ctx
}
