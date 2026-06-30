import { useEffect, useState } from 'react'
import type { Mesa, OrdenConDetalle } from '@shared/types'
import { ProveedorDatos, useDatos } from '@renderer/store/datos'
import { ProveedorToast } from '@renderer/components/Toast'
import { ProveedorAuth, useAuth } from '@renderer/store/auth'
import { ProveedorAutorizacion } from '@renderer/store/autorizacion'
import { ProveedorImpresion } from '@renderer/store/impresion'
import { SelectorBluetooth } from '@renderer/components/SelectorBluetooth'
import { LogoHermes } from '@renderer/components/LogoHermes'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { pesos } from '@renderer/lib/format'
import { Login } from '@renderer/pages/Login'
import { Mesas } from '@renderer/pages/Mesas'
import { Pedidos } from '@renderer/pages/Pedidos'
import { Cobro } from '@renderer/pages/Cobro'
import { Corte } from '@renderer/pages/Corte'
import { Catalogo } from '@renderer/pages/Catalogo'
import { Finanzas } from '@renderer/pages/Finanzas'
import { Reportes } from '@renderer/pages/Reportes'
import { Clientes } from '@renderer/pages/Clientes'
import { Inventario } from '@renderer/pages/Inventario'
import { Usuarios } from '@renderer/pages/Usuarios'
import { Ajustes } from '@renderer/pages/Ajustes'
import { Gastos } from '@renderer/pages/Gastos'
import type { Rol } from '@shared/types'

type Vista =
  | 'mesas'
  | 'pedidos'
  | 'cobro'
  | 'corte'
  | 'catalogo'
  | 'finanzas'
  | 'reportes'
  | 'clientes'
  | 'inventario'
  | 'usuarios'
  | 'ajustes'
  | 'gastos'

// `roles` indica qué roles ven cada sección.
const NAV: { id: Vista; label: string; icono: NombreIcono; roles: Rol[] }[] = [
  { id: 'mesas', label: 'Mesas', icono: 'mesas', roles: ['admin', 'cajero', 'mesero'] },
  { id: 'cobro', label: 'Cobro', icono: 'cobro', roles: ['admin', 'cajero', 'mesero'] },
  { id: 'gastos', label: 'Gastos', icono: 'gasto', roles: ['mesero'] },
  { id: 'finanzas', label: 'Finanzas', icono: 'finanzas', roles: ['admin'] },
  { id: 'reportes', label: 'Reportes', icono: 'corte', roles: ['admin'] },
  { id: 'clientes', label: 'Clientes', icono: 'usuarios', roles: ['admin', 'cajero'] },
  { id: 'corte', label: 'Corte de caja', icono: 'corte', roles: ['admin'] },
  { id: 'catalogo', label: 'Catálogo', icono: 'catalogo', roles: ['admin'] },
  { id: 'inventario', label: 'Inventario', icono: 'inventario', roles: ['admin'] },
  { id: 'usuarios', label: 'Usuarios', icono: 'usuarios', roles: ['admin'] },
  { id: 'ajustes', label: 'Ajustes', icono: 'ajustes', roles: ['admin'] }
]

const TITULOS: Record<Vista, string> = {
  mesas: 'Mesas',
  pedidos: 'Toma de pedido',
  cobro: 'Cobro',
  finanzas: 'Finanzas',
  reportes: 'Reportes',
  clientes: 'Clientes',
  inventario: 'Inventario',
  corte: 'Corte de caja',
  catalogo: 'Catálogo',
  usuarios: 'Usuarios',
  ajustes: 'Ajustes',
  gastos: 'Gastos'
}

interface PedidoActivo {
  ordenId: number
  titulo: string
  subtitulo: string
}

function Reloj(): React.JSX.Element {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 20000)
    return () => clearInterval(id)
  }, [])
  const fecha = ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const hm = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="text-right leading-tight">
      <div className="text-sm font-semibold text-tinta">{hm}</div>
      <div className="text-[11px] capitalize text-tinta-suave">{fecha}</div>
    </div>
  )
}

function Contenido(): React.JSX.Element {
  const { cargando, ordenes, resumen, abrirOrden, abrirOrdenLlevar, descartarOrden } = useDatos()
  const { usuarioActual, esAdmin, logout } = useAuth()
  const rol = usuarioActual?.rol
  const navVisible = NAV.filter((item) => rol != null && item.roles.includes(rol))
  const [vista, setVista] = useState<Vista>('mesas')
  const [pedido, setPedido] = useState<PedidoActivo | null>(null)
  const [ordenCobro, setOrdenCobro] = useState<number | null>(null)

  const balance =
    resumen.totalEfectivo + resumen.totalTarjeta + resumen.totalTransferencia - resumen.totalGastos

  // Al salir de Pedidos, descarta la orden si quedó sin productos (no la guarda).
  const descartarPedidoSiVacio = (): void => {
    if (!pedido) return
    const o = ordenes.find((x) => x.id === pedido.ordenId)
    if (o && o.detalle.length === 0) void descartarOrden(o.id)
  }

  const navegar = (destino: Vista): void => {
    if (vista === 'pedidos') descartarPedidoSiVacio()
    setVista(destino)
    if (destino !== 'cobro') setOrdenCobro(null)
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
      <div className="flex h-screen items-center justify-center bg-fondo text-tinta-suave">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-tinta" />
          Cargando Hermes…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-fondo text-tinta">
      {/* Barra lateral — clara y translúcida, estilo Apple */}
      <aside className="flex w-64 flex-col border-r border-black/[0.07] bg-white/70 backdrop-blur-xl">
        <div className="flex items-center justify-center px-5 pb-5 pt-10">
          <LogoHermes className="w-3/4 object-contain" />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-tinta-suave/70">
            Operación
          </div>
          {navVisible.map((item) => {
            const activo = vista === item.id || (item.id === 'mesas' && vista === 'pedidos')
            return (
              <button
                key={item.id}
                onClick={() => navegar(item.id)}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                  activo
                    ? 'bg-black/[0.06] font-semibold text-tinta'
                    : 'font-medium text-tinta-suave hover:bg-black/[0.04] hover:text-tinta'
                }`}
              >
                <span className={activo ? 'text-acento' : 'text-tinta-suave'}>
                  <Icono nombre={item.icono} size={18} />
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Balance del turno en el pie (solo admin) */}
        {esAdmin && (
          <div className="mx-3 mb-2 rounded-2xl bg-black/[0.04] px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-tinta-suave">
              Balance del turno
            </div>
            <div className={`text-xl font-semibold ${balance < 0 ? 'text-red-600' : 'text-tinta'}`}>
              {pesos(balance)}
            </div>
          </div>
        )}

        {/* Usuario y cerrar sesión */}
        <div className="border-t border-black/[0.07] px-3 py-3">
          <div className="flex items-center justify-between px-2">
            <div className="leading-tight">
              <div className="text-sm font-semibold text-tinta">{usuarioActual?.nombre}</div>
              <div className="text-[11px] capitalize text-tinta-suave">{usuarioActual?.rol}</div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-tinta-suave hover:bg-black/[0.05] hover:text-tinta"
            >
              <Icono nombre="salir" size={16} />
            </button>
          </div>
          <div className="mt-2 px-2 text-[11px] text-tinta-suave/70">v0.1.0 · Olyssea</div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barra superior translúcida */}
        <header className="flex items-center justify-between border-b border-black/[0.06] bg-white/60 px-8 py-3 backdrop-blur-xl">
          <div className="text-[15px] font-semibold tracking-tight text-tinta">{TITULOS[vista]}</div>
          <Reloj />
        </header>

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
              onVolver={() => navegar('mesas')}
              onCobrar={irACobro}
            />
          )}
          {vista === 'cobro' && <Cobro ordenIdInicial={ordenCobro} />}
          {vista === 'finanzas' && <Finanzas />}
          {vista === 'reportes' && <Reportes />}
          {vista === 'clientes' && <Clientes />}
          {vista === 'inventario' && <Inventario />}
          {vista === 'corte' && <Corte />}
          {vista === 'catalogo' && <Catalogo />}
          {vista === 'usuarios' && <Usuarios />}
          {vista === 'ajustes' && <Ajustes />}
          {vista === 'gastos' && <Gastos />}
        </main>
      </div>
    </div>
  )
}

// Muestra el login hasta que haya sesión; luego monta el resto de la app.
function Raiz(): React.JSX.Element {
  const { usuarioActual } = useAuth()
  if (!usuarioActual) return <Login />
  return (
    <ProveedorDatos>
      <ProveedorAutorizacion>
        <Contenido />
      </ProveedorAutorizacion>
    </ProveedorDatos>
  )
}

function App(): React.JSX.Element {
  return (
    <ProveedorToast>
      <ProveedorAuth>
        <ProveedorImpresion>
          <Raiz />
          <SelectorBluetooth />
        </ProveedorImpresion>
      </ProveedorAuth>
    </ProveedorToast>
  )
}

export default App
