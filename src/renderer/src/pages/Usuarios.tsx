import { useEffect, useState } from 'react'
import type { Rol, Usuario, UsuarioInput } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  cajero: 'Cajero',
  mesero: 'Mesero'
}

export function Usuarios(): React.JSX.Element {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [editando, setEditando] = useState<UsuarioInput | null>(null)
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null)

  const recargar = async (): Promise<void> => setUsuarios(await window.api.usuarios.listar())

  useEffect(() => {
    void recargar()
  }, [])

  const guardar = async (): Promise<void> => {
    if (!editando?.nombre?.trim()) return
    try {
      await window.api.usuarios.guardar({
        id: editando.id,
        nombre: editando.nombre.trim(),
        rol: editando.rol,
        email: editando.email,
        pin: editando.pin
      })
      setEditando(null)
      await recargar()
      toast('Usuario guardado')
    } catch (e) {
      toast(limpiar(e), 'error')
    }
  }

  const eliminar = async (): Promise<void> => {
    if (!aEliminar) return
    try {
      await window.api.usuarios.eliminar(aEliminar.id)
      setAEliminar(null)
      await recargar()
      toast(`${aEliminar.nombre} eliminado`, 'info')
    } catch (e) {
      setAEliminar(null)
      toast(limpiar(e), 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-sm text-slate-500">Cajeros y administradores · acceso por PIN</p>
        </div>
        <button
          onClick={() => setEditando({ nombre: '', rol: 'cajero', pin: '' })}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Nuevo usuario
        </button>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Rol</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.nombre}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      u.rol === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {ETIQUETA_ROL[u.rol]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{u.email ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditando({ id: u.id, nombre: u.nombre, rol: u.rol, email: u.email })}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Editar"
                    >
                      <Icono nombre="editar" size={16} />
                    </button>
                    <button
                      onClick={() => setAEliminar(u)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Icono nombre="eliminar" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={editando !== null}
        titulo={editando?.id ? 'Editar usuario' : 'Nuevo usuario'}
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button
              onClick={() => setEditando(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Guardar
            </button>
          </>
        }
      >
        {editando && (
          <div className="flex flex-col gap-3">
            <Campo label="Nombre">
              <input
                value={editando.nombre}
                onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </Campo>
            <Campo label="Rol">
              <select
                value={editando.rol}
                onChange={(e) => setEditando({ ...editando, rol: e.target.value as Rol })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="cajero">Cajero</option>
                <option value="mesero">Mesero</option>
                <option value="admin">Administrador</option>
              </select>
            </Campo>
            <Campo label={editando.id ? 'PIN (dejar vacío para no cambiar)' : 'PIN (4 dígitos)'}>
              <input
                inputMode="numeric"
                maxLength={6}
                value={editando.pin ?? ''}
                onChange={(e) =>
                  setEditando({ ...editando, pin: e.target.value.replace(/\D/g, '') })
                }
                placeholder="••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 tracking-widest outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </Campo>
            <Campo label="Email (opcional)">
              <input
                type="email"
                value={editando.email ?? ''}
                onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                placeholder="Para una futura versión en la nube"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </Campo>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar usuario"
        peligro
        textoConfirmar="Eliminar"
        mensaje={
          <>
            ¿Eliminar a <strong>{aEliminar?.nombre}</strong>?
          </>
        }
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

function limpiar(e: unknown): string {
  const crudo = e instanceof Error ? e.message : String(e)
  const partes = crudo.split('Error: ')
  return (partes[partes.length - 1] || crudo).trim() || 'Ocurrió un error'
}

function Campo({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}
