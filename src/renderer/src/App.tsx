import { useEffect, useState } from 'react'
import type { Mesa, OrdenConDetalle, Producto } from '@shared/types'
import { ProveedorDatos, useDatos } from '@renderer/store/datos'
import { ProveedorToast, useToast } from '@renderer/components/Toast'
import { useEscaner } from '@renderer/lib/escaner'
import { ProveedorAuth, useAuth } from '@renderer/store/auth'
import { ProveedorAutorizacion } from '@renderer/store/autorizacion'
import { ProveedorImpresion, useImpresion } from '@renderer/store/impresion'
import { SelectorBluetooth } from '@renderer/components/SelectorBluetooth'
import { TecladoVirtual } from '@renderer/components/TecladoVirtual'
import { LogoAnkyra } from '@renderer/components/LogoAnkyra'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { pesos } from '@renderer/lib/format'
import { Login } from '@renderer/pages/Login'
import { Mesas } from '@renderer/pages/Mesas'
import { Tienda } from '@renderer/pages/Tienda'
import { Pedidos } from '@renderer/pages/Pedidos'
import { Cobro } from '@renderer/pages/Cobro'
import { Corte } from '@renderer/pages/Corte'
import { Catalogo } from '@renderer/pages/Catalogo'
import { Reportes } from '@renderer/pages/Reportes'
import { Clientes } from '@renderer/pages/Clientes'
import { Inventario } from '@renderer/pages/Inventario'
import { Usuarios } from '@renderer/pages/Usuarios'
import { Ajustes } from '@renderer/pages/Ajustes'
import { Gastos } from '@renderer/pages/Gastos'
import type { Rol } from '@shared/types'

type Vista =
  | 'mesas'
  | 'tienda'
  | 'pedidos'
  | 'cobro'
  | 'corte'
  | 'catalogo'
  | 'reportes'
  | 'clientes'
  | 'inventario'
  | 'usuarios'
  | 'ajustes'
  | 'gastos'

// `roles` indica qué roles ven cada sección.
const NAV: { id: Vista; label: string; icono: NombreIcono; roles: Rol[] }[] = [
  { id: 'mesas', label: 'Mesas', icono: 'mesas', roles: ['admin', 'cajero', 'mesero'] },
  { id: 'tienda', label: 'Venta', icono: 'cobro', roles: ['admin', 'cajero', 'mesero'] },
  { id: 'cobro', label: 'Cobro', icono: 'cobro', roles: ['admin', 'cajero', 'mesero'] },
  { id: 'gastos', label: 'Gastos', icono: 'gasto', roles: ['mesero'] },
  { id: 'reportes', label: 'Reportes', icono: 'corte', roles: ['admin'] },
  { id: 'clientes', label: 'Clientes', icono: 'usuarios', roles: ['admin', 'cajero'] },
  { id: 'corte', label: 'Finanzas', icono: 'finanzas', roles: ['admin'] },
  { id: 'catalogo', label: 'Catálogo', icono: 'catalogo', roles: ['admin'] },
  { id: 'inventario', label: 'Inventario', icono: 'inventario', roles: ['admin'] },
  { id: 'usuarios', label: 'Usuarios', icono: 'usuarios', roles: ['admin'] },
  { id: 'ajustes', label: 'Ajustes', icono: 'ajustes', roles: ['admin'] }
]

const TITULOS: Record<Vista, string> = {
  mesas: 'Mesas',
  tienda: 'Venta',
  pedidos: 'Toma de pedido',
  cobro: 'Cobro',
  reportes: 'Reportes',
  clientes: 'Clientes',
  inventario: 'Inventario',
  corte: 'Finanzas',
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

// Indicador de estado de la impresora en la pantalla principal. Verde cuando está
// conectada (y se queda ahí), ámbar con botón cuando una impresora Bluetooth
// guardada quedó desconectada (típico al abrir el POS: Web Bluetooth olvida el
// permiso al cerrar) para reconectar con un clic sin ir hasta Ajustes.
function BannerReconectar(): React.JSX.Element | null {
  const { cfg, estados, conectar, conectando } = useImpresion()
  const configuradas = (cfg?.impresoras ?? []).filter(
    (i) => (i.tipo === 'bluetooth' && !!i.dispositivoId) || (i.tipo === 'com' && !!i.puerto)
  )
  if (configuradas.length === 0) return null

  const conectadas = configuradas.filter((i) => estados[i.id]?.conectado)

  // Si hay AL MENOS UNA impresora conectada, "en línea" (aunque otra guardada esté
  // desconectada). Solo se muestra "desconectada" cuando NINGUNA está conectada.
  if (conectadas.length > 0) {
    const texto =
      conectadas.length === 1
        ? `Impresora «${estados[conectadas[0].id]?.nombre || conectadas[0].nombre}» conectada`
        : `${conectadas.length} impresoras conectadas`
    return (
      <div className="animar-entrada mb-4 flex items-center gap-3.5 rounded-2xl border border-acento/20 bg-acento/[0.06] px-4 py-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acento/10 text-acento">
          <Icono nombre="imprimir" size={19} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-tinta">{texto}</div>
          <div className="text-xs text-tinta-suave">Lista para imprimir</div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          En línea
        </span>
      </div>
    )
  }

  // Ninguna conectada: ofrecer reconectar una Bluetooth guardada.
  const reconectar = configuradas.find((i) => i.tipo === 'bluetooth' && !estados[i.id]?.conectado)
  if (!reconectar) return null
  const ocupado = conectando === reconectar.id
  const etiqueta = reconectar.dispositivoNombre || reconectar.nombre
  return (
    <div className="animar-entrada mb-4 flex items-center gap-3.5 rounded-2xl border border-black/[0.08] bg-white px-4 py-3 shadow-sm">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.05] text-tinta-suave">
        <Icono nombre="imprimir" size={22} />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black leading-none text-white ring-2 ring-white">
          !
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-tinta">Impresora desconectada</div>
        <div className="truncate text-xs font-medium text-tinta-suave">
          «{etiqueta}» perdió la conexión Bluetooth
        </div>
      </div>
      <button
        onClick={() => void conectar(reconectar.id)}
        disabled={ocupado}
        className="btn-primario shrink-0"
      >
        <Icono nombre="recargar" size={15} className={ocupado ? 'animate-spin' : ''} />
        {ocupado ? 'Conectando…' : 'Reconectar'}
      </button>
    </div>
  )
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
  const { cargando, ordenes, productos, resumen, abrirOrden, abrirOrdenLlevar, descartarOrden } =
    useDatos()
  const { usuarioActual, esAdmin, logout } = useAuth()
  const { cfg } = useImpresion()
  const toast = useToast()
  const rol = usuarioActual?.rol
  // En modo tiendita la pantalla principal es "Venta" (productos) en vez de Mesas.
  const tiendita = cfg?.modoTiendita === true
  const navVisible = NAV.filter(
    (item) =>
      rol != null &&
      item.roles.includes(rol) &&
      (tiendita ? item.id !== 'mesas' : item.id !== 'tienda')
  )
  const [vista, setVista] = useState<Vista>('mesas')

  // Ajusta la pantalla inicial al activar/desactivar el modo tiendita.
  useEffect(() => {
    if (tiendita && vista === 'mesas') setVista('tienda')
    else if (!tiendita && vista === 'tienda') setVista('mesas')
  }, [tiendita, vista])
  const [pedido, setPedido] = useState<PedidoActivo | null>(null)
  const [ordenCobro, setOrdenCobro] = useState<number | null>(null)

  // Escaneo global de código de barras: estés donde estés (en modo tiendita), un
  // código detectado lleva a la Venta y agrega el producto. Se ignora si el foco
  // está en un campo (p. ej. al capturar el código en el editor de Catálogo).
  const [scanPendiente, setScanPendiente] = useState<{ producto: Producto; nonce: number } | null>(
    null
  )
  const alEscanear = (codigo: string): void => {
    const el = document.activeElement
    if (
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    )
      return
    // Compara sin distinguir mayúsculas ni espacios (códigos alfanuméricos).
    const cod = codigo.trim().toUpperCase()
    const p = productos.find((x) => x.activo && (x.codigoBarras ?? '').trim().toUpperCase() === cod)
    if (!p) {
      toast(`Código ${codigo} no encontrado`, 'error')
      return
    }
    setScanPendiente({ producto: p, nonce: Date.now() })
    setVista('tienda')
  }
  useEscaner(alEscanear, tiendita)

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

  const irAPedidosLlevar = async (nombre?: string): Promise<void> => {
    const o = await abrirOrdenLlevar(nombre)
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
          Cargando Ankyra…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white text-tinta">
      {/* Barra lateral — clara y translúcida, estilo Apple */}
      <aside className="flex w-64 flex-col">
        <div className="flex items-center justify-center px-5 pb-5 pt-10">
          <LogoAnkyra className="w-3/4 object-contain" />
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
          <div className="mt-2 px-2 text-[11px] text-tinta-suave/70">v0.6.0 · Olyssea</div>
        </div>
      </aside>

      {/* Columna principal: header transparente (parte del chrome) + contenido flotante */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barra superior transparente: se funde con el chrome blanco (barra lateral). */}
        <header>
          <div className="mx-auto grid w-full max-w-[1600px] grid-cols-3 items-center px-8 py-3">
            <div />
            <div className="text-center text-2xl font-bold tracking-tight text-tinta">
              {TITULOS[vista]}
            </div>
            <div className="flex justify-end">
              <Reloj />
            </div>
          </div>
        </header>

        {/* Contenido — panel gris flotante con esquinas redondeadas */}
        <main className="mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-2xl bg-fondo shadow-sm">
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col p-8">
          {vista !== 'ajustes' && <BannerReconectar />}
          <div key={vista} className="animar-entrada min-h-0 flex-1">
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
          {vista === 'tienda' && (
            <Tienda
              onCobrar={irACobro}
              escaneado={scanPendiente}
              onEscaneoConsumido={() => setScanPendiente(null)}
            />
          )}
          {vista === 'cobro' && <Cobro ordenIdInicial={ordenCobro} />}
          {vista === 'reportes' && <Reportes />}
          {vista === 'clientes' && <Clientes />}
          {vista === 'inventario' && <Inventario />}
          {vista === 'corte' && <Corte />}
          {vista === 'catalogo' && <Catalogo />}
          {vista === 'usuarios' && <Usuarios />}
          {vista === 'ajustes' && <Ajustes />}
          {vista === 'gastos' && <Gastos />}
          </div>
          </div>
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
          <TecladoVirtual />
        </ProveedorImpresion>
      </ProveedorAuth>
    </ProveedorToast>
  )
}

export default App
