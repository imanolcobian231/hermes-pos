import { useState } from 'react'
import type { Mesa, OrdenConDetalle } from '@shared/types'
import { ProveedorDatos, useDatos } from '@renderer/store/datos'
import { ProveedorToast } from '@renderer/components/Toast'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { Mesas } from '@renderer/pages/Mesas'
import { Pedidos } from '@renderer/pages/Pedidos'
import { Cobro } from '@renderer/pages/Cobro'
import { Corte } from '@renderer/pages/Corte'
import { Catalogo } from '@renderer/pages/Catalogo'

type Vista = 'mesas' | 'pedidos' | 'cobro' | 'corte' | 'catalogo'

const NAV: { id: Vista; label: string; icono: NombreIcono }[] = [
  { id: 'mesas', label: 'Mesas', icono: 'mesas' },
  { id: 'cobro', label: 'Cobro', icono: 'cobro' },
  { id: 'corte', label: 'Corte de caja', icono: 'corte' },
  { id: 'catalogo', label: 'Catálogo', icono: 'catalogo' }
]

interface PedidoActivo {
  ordenId: number
  titulo: string
  subtitulo: string
}

function Contenido(): React.JSX.Element {
  const { cargando, ordenes, abrirOrden, abrirOrdenLlevar, descartarOrden } = useDatos()
  const [vista, setVista] = useState<Vista>('mesas')
  const [pedido, setPedido] = useState<PedidoActivo | null>(null)
  const [ordenCobro, setOrdenCobro] = useState<number | null>(null)

  // Al salir de Pedidos, descarta la orden si quedó sin productos (no la guarda).
  const descartarPedidoSiVacio = (): void => {
    if (!pedido) return
    const o = ordenes.find((x) => x.id === pedido.ordenId)
    if (o && o.detalle.length === 0) void descartarOrden(o.id)
  }

  const irAPedidosMesa = async (mesa: Mesa): Promise<void> => {
    const o = await abrirOrden(mesa.id)
    setPedido({ ordenId: o.id, titulo: mesa.nombre, subtitulo: `${mesa.capacidad} personas` })
    setVista('pedidos')
  }

  const irAPedidosLlevar = async (): Promise<void> => {
    const o = await abrirOrdenLlevar()
    setPedido({ ordenId: o.id, titulo: o.nombre ?? 'Para llevar', subtitulo: 'Pedido para llevar' })
    setVista('pedidos')
  }

  const reabrirOrden = (o: OrdenConDetalle): void => {
    setPedido({
      ordenId: o.id,
      titulo: o.nombre ?? 'Para llevar',
      subtitulo: o.paraLlevar ? 'Pedido para llevar' : 'Mesa'
    })
    setVista('pedidos')
  }

  const irACobro = (ordenId: number): void => {
    setOrdenCobro(ordenId)
    setPedido(null)
    setVista('cobro')
  }

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-400">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Cargando Hermes POS…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      {/* Barra lateral */}
      <aside className="flex w-60 flex-col border-r border-slate-800 bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-base font-bold text-slate-950">
            H
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">HERMES POS</div>
            <div className="text-[11px] text-slate-500">Punto de venta</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Operación
          </div>
          {NAV.map((item) => {
            const activo = vista === item.id || (item.id === 'mesas' && vista === 'pedidos')
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (vista === 'pedidos') descartarPedidoSiVacio()
                  setVista(item.id)
                  if (item.id !== 'cobro') setOrdenCobro(null)
                }}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                  activo
                    ? 'bg-slate-800 font-semibold text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icono nombre={item.icono} size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-[11px] text-slate-600">
          v0.1.0 · Olyssea
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-auto p-8">
        {vista === 'mesas' && (
          <Mesas
            onAbrirMesa={irAPedidosMesa}
            onAbrirLlevar={irAPedidosLlevar}
            onAbrirOrden={reabrirOrden}
          />
        )}
        {vista === 'pedidos' && pedido && (
          <Pedidos
            ordenId={pedido.ordenId}
            titulo={pedido.titulo}
            subtitulo={pedido.subtitulo}
            onVolver={() => {
              descartarPedidoSiVacio()
              setVista('mesas')
            }}
            onCobrar={irACobro}
          />
        )}
        {vista === 'cobro' && <Cobro ordenIdInicial={ordenCobro} />}
        {vista === 'corte' && <Corte />}
        {vista === 'catalogo' && <Catalogo />}
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <ProveedorDatos>
      <ProveedorToast>
        <Contenido />
      </ProveedorToast>
    </ProveedorDatos>
  )
}

export default App
