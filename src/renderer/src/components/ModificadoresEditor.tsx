import { useState } from 'react'
import type { GrupoModificador } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Icono } from '@renderer/components/Icono'

interface Props {
  productoId: number
}

// Editor de grupos de modificadores de un producto. Lee los grupos del producto
// desde el store (se refresca solo tras cada cambio).
export function ModificadoresEditor({ productoId }: Props): React.JSX.Element {
  const { productos, guardarGrupo } = useDatos()
  const producto = productos.find((p) => p.id === productoId)
  const grupos = producto?.grupos ?? []

  const [nombreGrupo, setNombreGrupo] = useState('')
  const [obligatorio, setObligatorio] = useState(false)
  const [multiple, setMultiple] = useState(false)

  const agregarGrupo = async (): Promise<void> => {
    const nombre = nombreGrupo.trim()
    if (!nombre) return
    await guardarGrupo({
      productoId,
      nombre,
      obligatorio,
      multiple,
      orden: (grupos.at(-1)?.orden ?? 0) + 1
    })
    setNombreGrupo('')
    setObligatorio(false)
    setMultiple(false)
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Modificadores</h3>

      <div className="flex flex-col gap-3">
        {grupos.map((g) => (
          <GrupoFila key={g.id} grupo={g} />
        ))}
        {grupos.length === 0 && (
          <p className="text-xs text-slate-400">Sin grupos. Agrega uno abajo (ej. “Término”, “Extras”).</p>
        )}
      </div>

      {/* Alta de grupo */}
      <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
        <div className="flex gap-2">
          <input
            value={nombreGrupo}
            onChange={(e) => setNombreGrupo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarGrupo()}
            placeholder="Nuevo grupo (ej. Salsas)"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          <button
            onClick={agregarGrupo}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Agregar grupo
          </button>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-600">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={obligatorio}
              onChange={(e) => setObligatorio(e.target.checked)}
            />
            Obligatorio
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={multiple}
              onChange={(e) => setMultiple(e.target.checked)}
            />
            Selección múltiple
          </label>
        </div>
      </div>
    </div>
  )
}

function GrupoFila({ grupo }: { grupo: GrupoModificador }): React.JSX.Element {
  const { guardarModificador, eliminarModificador, eliminarGrupo } = useDatos()
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')

  const agregar = async (): Promise<void> => {
    const n = nombre.trim()
    if (!n) return
    await guardarModificador({ grupoId: grupo.id, nombre: n, precio: Number(precio) || 0 })
    setNombre('')
    setPrecio('')
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{grupo.nombre}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {grupo.obligatorio ? 'Obligatorio' : 'Opcional'}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {grupo.multiple ? 'Múltiple' : 'Único'}
          </span>
        </div>
        <button
          onClick={() => eliminarGrupo(grupo.id)}
          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Eliminar grupo"
        >
          <Icono nombre="eliminar" size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {grupo.modificadores.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{m.nombre}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{m.precio > 0 ? `+${pesos(m.precio)}` : 'sin costo'}</span>
              <button
                onClick={() => eliminarModificador(m.id)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Eliminar modificador"
              >
                <Icono nombre="cerrar" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Modificador"
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
        />
        <input
          type="number"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="$0"
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
        />
        <button
          onClick={agregar}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          +
        </button>
      </div>
    </div>
  )
}
