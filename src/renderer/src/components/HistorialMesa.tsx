import { useEffect, useState } from 'react'
import type { Mesa, OrdenConDetalle } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { TicketsRecientes } from '@renderer/components/TicketsRecientes'

interface Props {
  /** Mesa cuyo historial se muestra; null = modal cerrado. */
  mesa: Mesa | null
  onCerrar: () => void
}

// Historial de tickets cobrados de una mesa (recientes primero) con reimpresión.
// La UI vive en TicketsRecientes; aquí solo se cargan los tickets de la mesa.
export function HistorialMesa({ mesa, onCerrar }: Props): React.JSX.Element {
  const { historialMesa } = useDatos()
  const [tickets, setTickets] = useState<OrdenConDetalle[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!mesa) return
    let activo = true
    setCargando(true)
    setTickets([])
    historialMesa(mesa.id)
      .then((lista) => activo && setTickets(lista))
      .catch(() => activo && setTickets([]))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [mesa, historialMesa])

  return (
    <TicketsRecientes
      abierto={mesa !== null}
      titulo={mesa ? `Tickets de ${mesa.nombre}` : 'Tickets'}
      tickets={tickets}
      cargando={cargando}
      vacio="Sin tickets anteriores en esta mesa."
      onCerrar={onCerrar}
    />
  )
}
