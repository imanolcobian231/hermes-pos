import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Usuario } from '@shared/types'

interface AuthContextValue {
  usuarioActual: Usuario | null
  /** Intenta iniciar sesión; devuelve true si el PIN es correcto. */
  login: (usuarioId: number, pin: string) => Promise<boolean>
  /** Crea el primer administrador (solo en instalación nueva) e inicia sesión. */
  crearPrimerAdmin: (nombre: string, pin: string) => Promise<Usuario>
  logout: () => void
  esAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function ProveedorAuth({ children }: { children: ReactNode }): React.JSX.Element {
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null)

  const login = async (usuarioId: number, pin: string): Promise<boolean> => {
    const u = await window.api.usuarios.login(usuarioId, pin)
    if (u) {
      setUsuarioActual(u)
      return true
    }
    return false
  }

  const crearPrimerAdmin = async (nombre: string, pin: string): Promise<Usuario> => {
    const u = await window.api.usuarios.crearPrimerAdmin(nombre, pin)
    setUsuarioActual(u)
    return u
  }

  const logout = (): void => setUsuarioActual(null)

  return (
    <AuthContext.Provider
      value={{
        usuarioActual,
        login,
        crearPrimerAdmin,
        logout,
        esAdmin: usuarioActual?.rol === 'admin'
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <ProveedorAuth>')
  return ctx
}
