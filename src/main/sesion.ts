import type { Usuario } from '@shared/types'

// Sesión del usuario en el proceso main. Permite que los handlers IPC validen
// autorizaciones del lado del backend (no solo confiar en la UI) y estampar la
// identidad real en la auditoría.

let actual: Usuario | null = null

export function establecerSesion(u: Usuario | null): void {
  actual = u
}

export function sesionActual(): Usuario | null {
  return actual
}

export function esAdminEnSesion(): boolean {
  return actual?.rol === 'admin'
}
