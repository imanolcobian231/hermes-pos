import { useState } from 'react'
import type { GrupoModificador } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Icono } from '@renderer/components/Icono'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'

// Gestor global de grupos de modificadores reutilizables (pestaña de Catálogo).
export function GestorModificadores(): React.JSX.Element {
  const { grupos, productos, guardarGrupo } = useDatos()

  const [nombre, setNombre] = useState('')
  const [obligatorio, setObligatorio] = useState(false)
  const [multiple, setMultiple] = useState(false)

  const crear = async (): Promise<void> => {
    const n = nombre.trim()
    if (!n) return
    await guardarGrupo({ nombre: n, obligatorio, multiple })
    setNombre('')
    setObligatorio(false)
    setMultiple(false)
  }

  // Cuántos productos usan cada grupo.
  const usos = (grupoId: number): number =>
    productos.filter((p) => (p.grupos ?? []).some((g) => g.id === grupoId)).length

  return (
    <div className="flex-1 overflow-auto">
      <p className="mb-4 text-sm text-tinta-suave">
        Crea grupos reutilizables (ej. “Término”, “Salsas”, “Extras”) y asígnalos a los productos
        desde la pestaña Productos.
      </p>

      {/* Alta de grupo */}
      <div className="mb-5 rounded-xl border border-dashed border-black/10 p-4">
        <div className="flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crear()}
            placeholder="Nuevo grupo (ej. Salsas)"
            className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-acento"
          />
          <button
            onClick={crear}
            className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
          >
            Crear grupo
          </button>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-tinta-suave">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} />
            Obligatorio
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Selección múltiple
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {grupos.map((g) => (
          <GrupoCard key={g.id} grupo={g} usos={usos(g.id)} />
        ))}
        {grupos.length === 0 && (
          <p className="text-sm text-tinta-suave">Aún no hay grupos de modificadores.</p>
        )}
      </div>
    </div>
  )
}

function GrupoCard({ grupo, usos }: { grupo: GrupoModificador; usos: number }): React.JSX.Element {
  const { guardarGrupo, eliminarGrupo, guardarModificador, eliminarModificador } = useDatos()
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [aEliminar, setAEliminar] = useState(false)

  const agregar = async (): Promise<void> => {
    const n = nombre.trim()
    if (!n) return
    await guardarModificador({ grupoId: grupo.id, nombre: n, precio: Number(precio) || 0 })
    setNombre('')
    setPrecio('')
  }

  const toggleRegla = (campo: 'obligatorio' | 'multiple'): void => {
    void guardarGrupo({
      id: grupo.id,
      nombre: grupo.nombre,
      obligatorio: campo === 'obligatorio' ? !grupo.obligatorio : grupo.obligatorio,
      multiple: campo === 'multiple' ? !grupo.multiple : grupo.multiple
    })
  }

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="font-semibold text-tinta">{grupo.nombre}</div>
          <div className="text-xs text-tinta-suave">
            {usos} {usos === 1 ? 'producto' : 'productos'}
          </div>
        </div>
        <button
          onClick={() => setAEliminar(true)}
          className="rounded-md p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
          aria-label="Eliminar grupo"
        >
          <Icono nombre="eliminar" size={16} />
        </button>
      </div>

      <div className="mb-3 flex gap-2 text-xs">
        <button
          onClick={() => toggleRegla('obligatorio')}
          className={`rounded border px-2 py-0.5 font-semibold ${
            grupo.obligatorio ? 'border-acento bg-acento text-white' : 'border-black/[0.06] text-tinta-suave'
          }`}
        >
          {grupo.obligatorio ? 'Obligatorio' : 'Opcional'}
        </button>
        <button
          onClick={() => toggleRegla('multiple')}
          className={`rounded border px-2 py-0.5 font-semibold ${
            grupo.multiple ? 'border-acento bg-acento text-white' : 'border-black/[0.06] text-tinta-suave'
          }`}
        >
          {grupo.multiple ? 'Selección múltiple' : 'Selección única'}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {grupo.modificadores.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <span className="text-tinta">{m.nombre}</span>
            <div className="flex items-center gap-2">
              <span className="text-tinta-suave">{m.precio > 0 ? `+${pesos(m.precio)}` : 'sin costo'}</span>
              <button
                onClick={() => eliminarModificador(m.id)}
                className="rounded p-1 text-tinta-suave hover:bg-red-50 hover:text-red-600"
                aria-label="Eliminar modificador"
              >
                <Icono nombre="cerrar" size={13} />
              </button>
            </div>
          </div>
        ))}
        {grupo.modificadores.length === 0 && (
          <span className="text-xs text-tinta-suave">Sin modificadores todavía.</span>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Modificador"
          className="flex-1 rounded-md border border-black/10 px-2 py-1 text-sm outline-none focus:border-acento"
        />
        <input
          type="number"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="$0"
          className="w-20 rounded-md border border-black/10 px-2 py-1 text-right text-sm outline-none focus:border-acento"
        />
        <button
          onClick={agregar}
          className="rounded-md border border-black/10 px-3 py-1 text-sm font-semibold text-tinta hover:bg-black/[0.05]"
        >
          +
        </button>
      </div>

      <ConfirmDialog
        abierto={aEliminar}
        titulo="Eliminar grupo"
        peligro
        textoConfirmar="Eliminar"
        mensaje={
          <>
            ¿Eliminar el grupo <strong>{grupo.nombre}</strong> y sus modificadores? Se quitará de los{' '}
            {usos} productos que lo usan.
          </>
        }
        onConfirmar={() => {
          void eliminarGrupo(grupo.id)
          setAEliminar(false)
        }}
        onCancelar={() => setAEliminar(false)}
      />
    </div>
  )
}
