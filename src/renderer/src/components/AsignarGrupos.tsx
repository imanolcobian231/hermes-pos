import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'

interface Props {
  productoId: number
}

// Asignación de grupos de modificadores (reutilizables) a un producto.
export function AsignarGrupos({ productoId }: Props): React.JSX.Element {
  const { grupos, productos, asignarGrupo, desasignarGrupo } = useDatos()
  const producto = productos.find((p) => p.id === productoId)
  const asignados = new Set((producto?.grupos ?? []).map((g) => g.id))

  return (
    <div className="mt-4 border-t border-black/[0.04] pt-4">
      <h3 className="mb-1 text-sm font-semibold text-tinta">Grupos de modificadores</h3>
      <p className="mb-2 text-xs text-tinta-suave">
        Marca los grupos que aplican a este producto. Se crean y editan en la pestaña Modificadores.
      </p>

      {grupos.length === 0 ? (
        <p className="text-xs text-tinta-suave">
          No hay grupos. Créalos en la pestaña Modificadores.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {grupos.map((g) => {
            const marcado = asignados.has(g.id)
            return (
              <label
                key={g.id}
                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                  marcado ? 'border-acento bg-black/[0.03]' : 'border-black/[0.06] hover:border-black/15'
                }`}
              >
                <span className="flex items-center gap-2 text-tinta">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() =>
                      marcado ? desasignarGrupo(productoId, g.id) : asignarGrupo(productoId, g.id)
                    }
                  />
                  <span className="font-medium">{g.nombre}</span>
                  <span className="text-xs text-tinta-suave">
                    {g.obligatorio ? 'obligatorio' : 'opcional'} · {g.multiple ? 'varios' : 'uno'}
                  </span>
                </span>
                <span className="text-xs text-tinta-suave">
                  {g.modificadores.length} ·{' '}
                  {g.modificadores.some((m) => m.precio > 0)
                    ? `desde ${pesos(Math.min(...g.modificadores.filter((m) => m.precio > 0).map((m) => m.precio)))}`
                    : 'sin costo'}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
