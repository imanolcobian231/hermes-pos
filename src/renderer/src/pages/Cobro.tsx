import { useEffect, useMemo, useState } from 'react'
import type {
  DetalleOrden,
  MetodoPago,
  MetodoPagoOrden,
  NotaVenta,
  OrdenConDetalle,
  Pago
} from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { TicketCocina } from '@renderer/components/TicketCocina'
import { TicketFinal } from '@renderer/components/TicketFinal'
import { NotaVentaDialog } from '@renderer/components/NotaVentaDialog'
import { Select } from '@renderer/components/Select'
import { useToast } from '@renderer/components/Toast'
import { useAuth } from '@renderer/store/auth'
import { useAutorizacion } from '@renderer/store/autorizacion'
import { useImpresion } from '@renderer/store/impresion'
import { comandasPorArea, expandirCombos, rolesConfigurados } from '@renderer/lib/comandas'
import { calcularImpuesto } from '@shared/impuestos'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

interface Props {
  /** Orden preseleccionada al llegar desde Pedidos. */
  ordenIdInicial?: number | null
}

const METODOS: { id: MetodoPago; label: string; icono: NombreIcono }[] = [
  { id: 'efectivo', label: 'Efectivo', icono: 'efectivo' },
  { id: 'tarjeta', label: 'Tarjeta', icono: 'tarjeta' },
  { id: 'transferencia', label: 'Transferencia', icono: 'transferencia' }
]

// Opciones del selector: los tres métodos + pago mixto + crédito (fiar).
const OPCIONES: { id: MetodoPago | 'mixto' | 'credito'; label: string; icono: NombreIcono }[] = [
  ...METODOS,
  { id: 'mixto', label: 'Mixto', icono: 'cobro' },
  { id: 'credito', label: 'Crédito', icono: 'usuarios' }
]

const VACIO_MIXTO: Record<MetodoPago, string> = { efectivo: '', tarjeta: '', transferencia: '' }

const RAPIDOS = [50, 100, 200, 500]

// Etiqueta de sección del panel de pago (misma tipografía en todas).
function Etiqueta({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
      {children}
    </div>
  )
}

// Botón que abre/cierra una sección (Descuento, Propina) con chevron y badge.
function BotonColapsable({
  label,
  abierto,
  onToggle,
  badge
}: {
  label: string
  abierto: boolean
  onToggle: () => void
  badge?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-black/[0.02] px-3.5 py-2.5 text-sm font-semibold text-tinta-suave transition-colors hover:border-acento/40 hover:text-acento"
    >
      <span className="flex items-center gap-2">
        {label}
        {badge && (
          <span className="rounded-full bg-acento/10 px-2 py-0.5 text-[11px] font-bold text-acento">
            {badge}
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

// Contenedor que anima su altura al abrir/cerrar (grid 0fr→1fr, suave en Chromium).
function Colapsable({
  abierto,
  children
}: {
  abierto: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

// Clase de las pastillas de selección (descuento/propina): activa en teal.
function pill(activo: boolean): string {
  return `rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
    activo
      ? 'border-transparent bg-acento text-white shadow-sm shadow-acento/25'
      : 'border-black/[0.06] bg-black/[0.02] text-tinta-suave hover:border-acento/40 hover:bg-acento/[0.05] hover:text-acento'
  }`
}

export function Cobro({ ordenIdInicial }: Props): React.JSX.Element {
  const { mesas, ordenes, productos, categorias, clientes, caja, abrirCaja, cambiarNotaOrden, cobrarOrden, fiarOrden, registrarReimpresion } =
    useDatos()
  const { usuarioActual } = useAuth()
  const { pedir } = useAutorizacion()
  const { imprimirFinal, imprimirComandas, cfg, impresoras } = useImpresion()
  const toast = useToast()

  // Etiqueta de la orden: nombre de la mesa o el rótulo del pedido para llevar.
  // En modo tiendita no hay mesas ni "para llevar": es una venta directa, así que
  // se rotula como "Venta #N" en vez de "Para llevar".
  const tiendita = cfg?.modoTiendita === true
  // Modo restaurante: al cobrar no se pregunta el método (no se sabe cómo pagará
  // hasta entregar el ticket); se asume pagado en efectivo y luego, si fue otro
  // método, se corrige desde el corte. En tiendita sí se cobra con método.
  const restaurante = !tiendita
  const etiqueta = useMemo(() => {
    const nombreMesa = (mesaId: number | null): string =>
      mesas.find((m) => m.id === mesaId)?.nombre ?? 'Mesa'
    return (o: OrdenConDetalle): string =>
      o.paraLlevar
        ? o.nombre ?? (tiendita ? `Venta #${o.id}` : 'Para llevar')
        : nombreMesa(o.mesaId)
  }, [mesas, tiendita])

  const porCobrar = useMemo(
    () => ordenes.filter((o) => o.estado === 'abierta' && o.porCobrar),
    [ordenes]
  )

  const [ordenId, setOrdenId] = useState<number | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago | 'mixto' | 'credito'>('efectivo')
  const [recibidoTexto, setRecibidoTexto] = useState('')
  const [mixto, setMixto] = useState<Record<MetodoPago, string>>(VACIO_MIXTO)
  const [clienteSel, setClienteSel] = useState<number | null>(null)
  const [descuento, setDescuento] = useState(0)
  const [propinaTexto, setPropinaTexto] = useState('')
  // Fondo para abrir la caja desde aquí cuando está cerrada (flujo estricto).
  const [fondoCaja, setFondoCaja] = useState('')
  // Descuento y propina van ocultos, cada uno tras su propio botón (panel más corto).
  const [verDescuento, setVerDescuento] = useState(false)
  const [verPropina, setVerPropina] = useState(false)
  // Nota libre que se imprime en el ticket (colapsable).
  const [verNota, setVerNota] = useState(false)
  const [notaTicket, setNotaTicket] = useState('')
  // PIN autorizado para el descuento (se valida también en el backend al cobrar).
  const [pinDescuento, setPinDescuento] = useState<string | undefined>(undefined)
  // Evita doble cobro/cargo por doble clic en "Listo".
  const [procesando, setProcesando] = useState(false)
  // Ticket final tras cobrar (modo simulación) y reimpresión de cocina.
  const [ticketFinal, setTicketFinal] = useState<{ titulo: string; orden: OrdenConDetalle } | null>(
    null
  )
  const [esCopia, setEsCopia] = useState(false)
  // Comprobante / nota de venta: diálogo de captura y datos para el preview.
  const [notaAbierto, setNotaAbierto] = useState(false)
  const [notaPreview, setNotaPreview] = useState<NotaVenta | null>(null)
  const [ticketCocina, setTicketCocina] = useState<{ titulo: string; lineas: DetalleOrden[] } | null>(
    null
  )

  // Selección automática: orden que viene de Pedidos, o la primera disponible.
  useEffect(() => {
    if (ordenId && porCobrar.some((o) => o.id === ordenId)) return
    const inicial = ordenIdInicial
      ? porCobrar.find((o) => o.id === ordenIdInicial)
      : undefined
    setOrdenId((inicial ?? porCobrar[0])?.id ?? null)
  }, [ordenIdInicial, porCobrar, ordenId])

  // Al cambiar de cuenta, reinicia método, descuento y montos.
  useEffect(() => {
    setMetodo('efectivo')
    setDescuento(0)
    setPropinaTexto('')
    setRecibidoTexto('')
    setMixto(VACIO_MIXTO)
    setClienteSel(null)
    setPinDescuento(undefined)
    setVerNota(false)
  }, [ordenId])

  const orden = porCobrar.find((o) => o.id === ordenId) ?? null
  // Prellena la nota del ticket con la que ya tenga la orden (si aplica).
  useEffect(() => {
    setNotaTicket(orden?.nota ?? '')
  }, [orden?.id, orden?.nota])
  const subtotal = orden?.total ?? 0
  const descClamp = Math.max(0, Math.min(descuento, subtotal))
  const imp = calcularImpuesto(
    subtotal - descClamp,
    cfg ?? { impuestoActivo: false, impuestoTasa: 0, impuestoIncluido: true }
  )
  const propina = Math.max(0, parseFloat(propinaTexto) || 0)
  // Lo que paga el cliente = venta (con IVA) + propina.
  const neto = imp.total + propina
  // Redondeo de efectivo: si está configurado, el pago en efectivo se ajusta al
  // múltiplo (ej. $0.50 o $1). No aplica a tarjeta/transferencia/mixto/crédito.
  const pasoRedondeo = cfg?.redondeoEfectivo ?? 0
  const netoACobrar =
    metodo === 'efectivo' && pasoRedondeo > 0
      ? Math.round(Math.round(neto / pasoRedondeo) * pasoRedondeo * 100) / 100
      : neto
  const redondeo = Math.round((netoACobrar - neto) * 100) / 100
  const recibido = parseFloat(recibidoTexto) || 0
  const cambio = recibido - netoACobrar

  // Pago mixto: monto asignado por método y lo que falta por cubrir.
  const montoMix: Record<MetodoPago, number> = {
    efectivo: parseFloat(mixto.efectivo) || 0,
    tarjeta: parseFloat(mixto.tarjeta) || 0,
    transferencia: parseFloat(mixto.transferencia) || 0
  }
  const asignado = montoMix.efectivo + montoMix.tarjeta + montoMix.transferencia
  const restante = Math.round((neto - asignado) * 100) / 100

  const ponerResto = (m: MetodoPago): void => {
    const otros = asignado - montoMix[m]
    const falta = Math.max(0, Math.round((neto - otros) * 100) / 100)
    setMixto((s) => ({ ...s, [m]: String(falta) }))
  }

  // En restaurante el efectivo se asume exacto (no se captura monto recibido).
  const efectivoInsuficiente = metodo === 'efectivo' && !restaurante && recibido < netoACobrar
  const mixtoInvalido = metodo === 'mixto' && Math.abs(restante) >= 0.01
  const faltaCliente = metodo === 'credito' && clienteSel == null
  const noPuedeCobrar = efectivoInsuficiente || mixtoInvalido || faltaCliente

  // Arma el desglose de pagos según el método elegido (no aplica a crédito,
  // que se maneja por separado en confirmar).
  const construirPagos = (): { pagos: Pago[]; efectivoRecibido?: number; cambio: number } => {
    if (metodo === 'credito') return { pagos: [], efectivoRecibido: undefined, cambio: 0 }
    if (metodo === 'mixto') {
      const pagos = METODOS.map((m) => ({ metodo: m.id, monto: montoMix[m.id] })).filter(
        (p) => p.monto > 0
      )
      // En mixto, la parte en efectivo se asume exacta (sin cambio).
      return { pagos, efectivoRecibido: montoMix.efectivo > 0 ? montoMix.efectivo : undefined, cambio: 0 }
    }
    if (metodo === 'efectivo') {
      // Restaurante: pago exacto sin cambio (se asume pagado al entregar el ticket).
      if (restaurante) {
        return { pagos: [{ metodo: 'efectivo', monto: netoACobrar }], efectivoRecibido: netoACobrar, cambio: 0 }
      }
      return { pagos: [{ metodo: 'efectivo', monto: netoACobrar }], efectivoRecibido: recibido, cambio: Math.max(0, cambio) }
    }
    return { pagos: [{ metodo, monto: neto }], efectivoRecibido: undefined, cambio: 0 }
  }

  // Aplicar un descuento requiere autorización de administrador (el PIN se
  // revalida en el backend al momento de cobrar).
  const confirmar = (): void => {
    if (descClamp > 0) {
      pedir((pin) => {
        setPinDescuento(pin)
        ejecutarConfirmar()
      }, 'Aplicar un descuento')
    } else {
      setPinDescuento(undefined)
      ejecutarConfirmar()
    }
  }

  // Muestra el ticket como vista previa. El cobro NO se confirma aquí: se
  // confirma al dar "Listo" (finalizar).
  const ejecutarConfirmar = (): void => {
    if (!orden) return
    // Persiste la nota del ticket (por si se cobró sin salir del campo).
    if ((orden.nota ?? '') !== notaTicket.trim()) void cambiarNotaOrden(orden.id, notaTicket)
    const baseTicket = {
      ...orden,
      estado: 'cobrada' as const,
      descuento: descClamp,
      propina,
      nota: notaTicket.trim() || undefined,
      cerradoEn: new Date().toISOString()
    }
    if (metodo === 'credito') {
      setTicketFinal({
        titulo: etiqueta(orden),
        orden: { ...baseTicket, metodoPago: 'credito', pagos: [], montoRecibido: undefined, cambio: 0 }
      })
      setEsCopia(false)
      setNotaPreview(null)
      return
    }
    const { pagos, efectivoRecibido, cambio: cambioFinal } = construirPagos()
    const metodoOrden: MetodoPagoOrden = pagos.length > 1 ? 'mixto' : pagos[0].metodo
    setTicketFinal({
      titulo: etiqueta(orden),
      orden: {
        ...baseTicket,
        metodoPago: metodoOrden,
        pagos,
        montoRecibido: efectivoRecibido,
        cambio: cambioFinal
      }
    })
    setEsCopia(false)
    setNotaPreview(null)
  }

  // Confirma el cobro (cierra la venta) al dar "Listo".
  const finalizar = async (): Promise<void> => {
    if (!ticketFinal || procesando) return
    const snap = ticketFinal.orden
    const esCredito = snap.metodoPago === 'credito'
    const cliente = clienteSel
    if (esCredito && cliente == null) return

    // El cobro/cargo se hace UNA sola vez; el botón queda bloqueado mientras tanto.
    setProcesando(true)
    try {
      if (esCredito) {
        await fiarOrden(snap.id, cliente as number, snap.descuento)
      } else {
        await cobrarOrden(
          snap.id,
          snap.pagos ?? [],
          snap.montoRecibido,
          snap.descuento,
          snap.propina,
          pinDescuento
        )
      }
    } catch (e) {
      // Si falla, NO cerramos el ticket: se puede reintentar sin doble cargo.
      toast(e instanceof Error ? e.message : 'No se pudo cerrar la venta', 'error')
      setProcesando(false)
      return
    }
    // Imprime el ticket de caja (ya cerrada en la DB).
    try {
      await imprimirFinal(snap.id)
      toast(`${ticketFinal.titulo} ${esCredito ? 'fiada' : 'cobrada'} · ticket impreso`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Cerrada, pero no se pudo imprimir el ticket', 'error')
    }
    setTicketFinal(null)
    setRecibidoTexto('')
    setMixto(VACIO_MIXTO)
    setClienteSel(null)
    setMetodo('efectivo')
    setDescuento(0)
    setPinDescuento(undefined)
    setProcesando(false)
    setOrdenId(null)
  }

  const reimprimirCocina = async (): Promise<void> => {
    if (!orden) return
    const enviadas = orden.detalle.filter((d) => d.enviadoCocina)
    if (enviadas.length === 0) return
    registrarReimpresion('cocina', orden.id, usuarioActual?.nombre)
    const paraCocina = expandirCombos(enviadas, productos)
    setTicketCocina({ titulo: etiqueta(orden), lineas: paraCocina })
    try {
      const unica = cfg?.modo === 'una' ? cfg.impresoraCajaId ?? null : null
      const { grupos } = comandasPorArea(
        paraCocina,
        productos,
        categorias,
        rolesConfigurados(impresoras, cfg?.impresoraCocinaId ?? null, cfg?.impresoraBarraId ?? null),
        unica,
        cfg?.separarBarra !== false
      )
      await imprimirComandas(
        grupos.map((g) => ({
          impresoraId: g.impresoraId,
          titulo: etiqueta(orden),
          lineas: g.lineas,
          opciones: { reimpresion: true, area: g.area }
        }))
      )
      toast('Comanda de cocina reimpresa', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo reimprimir la comanda', 'error')
    }
  }

  const reimprimirCopia = async (): Promise<void> => {
    if (!ticketFinal) return
    registrarReimpresion('final', ticketFinal.orden.id, usuarioActual?.nombre)
    setEsCopia(true)
    try {
      await imprimirFinal(ticketFinal.orden.id, { copia: true })
      toast('Copia del ticket reimpresa', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo reimprimir la copia', 'error')
    }
  }

  const imprimirNotaVenta = async (nota: NotaVenta): Promise<void> => {
    if (!ticketFinal) return
    setNotaAbierto(false)
    setNotaPreview(nota)
    try {
      await imprimirFinal(ticketFinal.orden.id, { notaVenta: nota })
      toast('Comprobante impreso', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir el comprobante', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <p className="text-sm text-tinta-suave">Selecciona una cuenta por cobrar y registra el pago</p>
      </header>

      {porCobrar.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
          <Icono nombre="recibo" size={40} className="text-tinta-suave/60" />
          <p className="mt-3 font-semibold">No hay cuentas por cobrar</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-6">
          {/* Lista de cuentas por cobrar */}
          <div className="flex w-72 flex-col gap-2 overflow-auto">
            {porCobrar.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrdenId(o.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  ordenId === o.id
                    ? 'border-acento bg-acento/[0.06] shadow-sm'
                    : 'border-black/[0.08] bg-white hover:border-acento/40'
                }`}
              >
                <span className="font-semibold text-tinta">{etiqueta(o)}</span>
                <span className="font-bold text-tinta">{pesos(o.total)}</span>
              </button>
            ))}
          </div>

          {/* Panel de cobro */}
          {orden && (
            <div className="flex min-h-0 flex-1 gap-6">
              {/* Detalle */}
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-tinta">{etiqueta(orden)}</h2>
                  {/* En tiendita no hay cocina: se oculta la reimpresión de comanda. */}
                  {!tiendita && (
                    <button
                      onClick={reimprimirCocina}
                      className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold text-tinta-suave transition hover:border-acento/40 hover:text-tinta"
                      title="Reimprimir comanda de cocina"
                    >
                      <Icono nombre="imprimir" size={14} />
                      Reimprimir cocina
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {orden.detalle.map((d) => (
                    <div key={d.id} className="py-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-tinta-suave">
                          {d.cantidad}× {d.nombreProducto}
                        </span>
                        <span className="font-medium text-tinta">
                          {pesos(d.cantidad * d.precioUnitario)}
                        </span>
                      </div>
                      {d.modificadores.map((m) => (
                        <div key={m.id} className="pl-4 text-xs text-tinta-suave">
                          + {m.nombre}
                        </div>
                      ))}
                      {d.descuento > 0 && (
                        <div className="flex justify-between pl-4 text-xs text-tinta-suave">
                          <span>Descuento</span>
                          <span>−{pesos(d.descuento)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-black/[0.04] pt-3">
                  {descClamp > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-tinta-suave">
                        <span>Importe</span>
                        <span>{pesos(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-tinta-suave">
                        <span>Descuento</span>
                        <span>−{pesos(descClamp)}</span>
                      </div>
                    </>
                  )}
                  {imp.lineas.length > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-tinta-suave">
                        <span>Subtotal</span>
                        <span>{pesos(imp.base)}</span>
                      </div>
                      {imp.lineas.map((t, i) => (
                        <div key={i} className="flex justify-between text-sm text-tinta-suave">
                          <span>
                            {t.nombre} {t.tasa}%
                          </span>
                          <span>{pesos(t.monto)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {propina > 0 && (
                    <div className="flex justify-between text-sm text-tinta-suave">
                      <span>Propina</span>
                      <span>{pesos(propina)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl">
                    <span className="font-semibold text-tinta-suave">Total</span>
                    <span className="font-bold text-tinta">{pesos(neto)}</span>
                  </div>
                </div>
              </div>

              {/* Pago */}
              <div className="flex min-h-0 w-80 flex-col rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
                {!caja.abierta ? (
                  /* Flujo estricto: hay que abrir la caja (con su fondo) para cobrar. */
                  /* Solo admin/cajero pueden abrirla; un mesero solo ve el error. */
                  <div className="flex flex-1 animar-fundido flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.05] text-tinta-suave">
                      <Icono nombre="corte" size={26} />
                    </span>
                    {usuarioActual?.rol === 'mesero' ? (
                      <p className="font-semibold text-red-600">
                        No se pueden realizar cobros, la caja esta cerrada
                      </p>
                    ) : (
                      <>
                        <div>
                          <p className="font-semibold text-tinta">La caja está cerrada</p>
                          <p className="mt-0.5 text-sm text-tinta-suave">
                            Ábrela con su fondo de cambio para poder cobrar.
                          </p>
                        </div>
                        <div className="flex w-full items-center gap-1 rounded-xl border border-black/10 px-3 focus-within:border-acento">
                          <span className="text-sm text-tinta-suave">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={fondoCaja}
                            onChange={(e) => setFondoCaja(e.target.value)}
                            placeholder="Fondo inicial"
                            className="w-full bg-transparent py-2.5 text-right outline-none"
                          />
                        </div>
                        <button
                          onClick={() => void abrirCaja(Number(fondoCaja) || 0)}
                          className="btn-primario w-full"
                        >
                          Abrir caja
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                {/* Total a cobrar — foco del panel */}
                <div className="mb-4 shrink-0 rounded-xl bg-acento/[0.06] px-4 py-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-acento/80">
                    Total a cobrar
                  </div>
                  <div className="text-3xl font-bold tabular-nums tracking-tight text-acento">
                    {pesos(netoACobrar)}
                  </div>
                  {redondeo !== 0 && (
                    <div className="text-[11px] font-medium text-acento/70">
                      redondeo {redondeo > 0 ? '+' : '−'}
                      {pesos(Math.abs(redondeo))} · exacto {pesos(neto)}
                    </div>
                  )}
                </div>
                {/* Contenido con scroll interno: el panel no cambia de tamaño al
                    alternar método (evita los saltos de layout). */}
                <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                {restaurante ? (
                  /* Modo restaurante: se asume pagado (efectivo); solo se ofrece
                     fiar a crédito. El método real se corrige luego en el corte. */
                  <div className="mb-4">
                    <div className="mb-3 flex items-start gap-2 rounded-xl bg-acento/[0.05] px-3 py-2.5 text-xs text-tinta-suave">
                      <Icono nombre="info" size={15} className="mt-0.5 shrink-0 text-acento" />
                      Se registra como pagado. Si fue tarjeta o transferencia, ajústalo en el corte.
                    </div>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.08] px-3 py-2.5 transition hover:border-acento/40">
                      <input
                        type="checkbox"
                        checked={metodo === 'credito'}
                        onChange={(e) => setMetodo(e.target.checked ? 'credito' : 'efectivo')}
                        className="h-4 w-4 rounded"
                      />
                      <span className="text-sm text-tinta">
                        Fiar a crédito
                        <span className="block text-xs text-tinta-suave">
                          El cliente paga después (se carga a su cuenta).
                        </span>
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="mb-4">
                    <Etiqueta>Método de pago</Etiqueta>
                    <div className="grid grid-cols-2 gap-2">
                      {OPCIONES.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMetodo(m.id)}
                          className={`flex flex-col items-center gap-2 rounded-2xl border py-3.5 text-xs font-semibold transition-colors ${
                            metodo === m.id
                              ? 'border-transparent bg-acento text-white shadow-md shadow-acento/25'
                              : 'border-black/[0.06] bg-black/[0.02] text-tinta-suave hover:border-acento/40 hover:bg-acento/[0.05] hover:text-acento'
                          }`}
                        >
                          <Icono nombre={m.icono} size={22} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descuento (colapsable con transición suave) */}
                <div className="mb-3">
                  <BotonColapsable
                    label="Descuento"
                    abierto={verDescuento}
                    onToggle={() => setVerDescuento((v) => !v)}
                    badge={descClamp > 0 ? `−${pesos(descClamp)}` : undefined}
                  />
                  <Colapsable abierto={verDescuento}>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {[0, 10, 15, 20].map((p) => {
                        const monto = p === 0 ? 0 : Math.round(subtotal * p) / 100
                        const activo = descClamp === monto && (p !== 0 || descClamp === 0)
                        return (
                          <button key={p} onClick={() => setDescuento(monto)} className={pill(activo)}>
                            {p === 0 ? 'Sin' : `${p}%`}
                          </button>
                        )
                      })}
                      <div className="flex items-center gap-1 rounded-lg border border-black/[0.08] px-2 focus-within:border-acento">
                        <span className="text-sm text-tinta-suave">$</span>
                        <input
                          type="number"
                          value={descuento || ''}
                          onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="Otro"
                          className="w-16 bg-transparent py-1.5 text-right text-sm outline-none"
                        />
                      </div>
                    </div>
                  </Colapsable>
                </div>

                {/* Propina (colapsable; no aplica a crédito/fiado) */}
                {metodo !== 'credito' && (
                  <div className="mb-3">
                    <BotonColapsable
                      label="Propina"
                      abierto={verPropina}
                      onToggle={() => setVerPropina((v) => !v)}
                      badge={propina > 0 ? `+${pesos(propina)}` : undefined}
                    />
                    <Colapsable abierto={verPropina}>
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {[0, 5, 10, 15].map((p) => {
                          const monto = p === 0 ? 0 : Math.round(imp.total * p) / 100
                          const activo = Math.abs(propina - monto) < 0.01 && (p !== 0 || propina === 0)
                          return (
                            <button
                              key={p}
                              onClick={() => setPropinaTexto(monto ? String(monto) : '')}
                              className={pill(activo)}
                            >
                              {p === 0 ? 'Sin' : `${p}%`}
                            </button>
                          )
                        })}
                        <div className="flex items-center gap-1 rounded-lg border border-black/[0.08] px-2 focus-within:border-acento">
                          <span className="text-sm text-tinta-suave">$</span>
                          <input
                            type="number"
                            value={propinaTexto}
                            onChange={(e) => setPropinaTexto(e.target.value)}
                            placeholder="Otra"
                            className="w-16 bg-transparent py-1.5 text-right text-sm outline-none"
                          />
                        </div>
                      </div>
                    </Colapsable>
                  </div>
                )}

                {/* Nota del ticket (colapsable): texto libre que se imprime */}
                <div className="mb-3">
                  <BotonColapsable
                    label="Nota del ticket"
                    abierto={verNota}
                    onToggle={() => setVerNota((v) => !v)}
                    badge={notaTicket.trim() ? 'nota' : undefined}
                  />
                  <Colapsable abierto={verNota}>
                    <textarea
                      value={notaTicket}
                      onChange={(e) => setNotaTicket(e.target.value)}
                      onBlur={() => {
                        if (orden && (orden.nota ?? '') !== notaTicket.trim())
                          void cambiarNotaOrden(orden.id, notaTicket)
                      }}
                      rows={2}
                      maxLength={120}
                      placeholder="Ej. Para Juan · sin picante · dirección…"
                      className="mt-2 w-full resize-y rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                    />
                  </Colapsable>
                </div>

                {metodo === 'efectivo' && !restaurante && (
                  <div className="mb-4 animar-fundido">
                    <Etiqueta>Monto recibido</Etiqueta>
                    <input
                      type="number"
                      value={recibidoTexto}
                      onChange={(e) => setRecibidoTexto(e.target.value)}
                      placeholder="0.00"
                      className="mb-2 w-full rounded-xl border border-black/10 px-3 py-2.5 text-right text-lg font-bold outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                    />
                    <div className="mb-2 flex flex-wrap gap-2">
                      {RAPIDOS.map((v) => (
                        <button
                          key={v}
                          onClick={() => setRecibidoTexto(String(v))}
                          className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-3.5 py-2 text-sm font-semibold text-tinta-suave transition-colors hover:border-acento/40 hover:bg-acento/[0.05] hover:text-acento"
                        >
                          ${v}
                        </button>
                      ))}
                      <button
                        onClick={() => setRecibidoTexto(String(netoACobrar))}
                        className="rounded-lg border border-acento/30 bg-acento/[0.08] px-3.5 py-2 text-sm font-bold text-acento transition-colors hover:bg-acento/15"
                      >
                        Exacto
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                      <span className="font-semibold text-tinta-suave">Cambio</span>
                      <span
                        className={`text-xl font-bold tabular-nums ${cambio < 0 ? 'text-red-600' : 'text-tinta'}`}
                      >
                        {pesos(Math.max(0, cambio))}
                      </span>
                    </div>
                  </div>
                )}

                {metodo === 'mixto' && (
                  <div className="mb-4 animar-fundido">
                    <Etiqueta>Reparte el pago</Etiqueta>
                    <div className="flex flex-col gap-2">
                      {METODOS.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-tinta-suave">
                            <Icono nombre={m.icono} size={15} />
                            {m.label}
                          </span>
                          <div className="flex flex-1 items-center gap-1 rounded-lg border border-black/[0.08] px-2 focus-within:border-acento">
                            <span className="text-sm text-tinta-suave">$</span>
                            <input
                              type="number"
                              value={mixto[m.id]}
                              onChange={(e) => setMixto((s) => ({ ...s, [m.id]: e.target.value }))}
                              placeholder="0.00"
                              className="w-full bg-transparent py-1.5 text-right text-sm outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => ponerResto(m.id)}
                            className="rounded-lg border border-black/[0.06] bg-black/[0.02] px-2.5 py-1.5 text-xs font-semibold text-tinta-suave transition-colors hover:border-acento/40 hover:bg-acento/[0.05] hover:text-acento"
                            title="Asignar lo que falta a este método"
                          >
                            resto
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                      <span className="font-semibold text-tinta-suave">
                        {restante > 0 ? 'Falta' : restante < 0 ? 'Sobra' : 'Restante'}
                      </span>
                      <span
                        className={`text-xl font-bold tabular-nums ${
                          Math.abs(restante) < 0.01 ? 'text-acento' : 'text-red-600'
                        }`}
                      >
                        {pesos(Math.abs(restante))}
                      </span>
                    </div>
                  </div>
                )}

                {metodo === 'credito' && (
                  <div className="mb-4 animar-fundido">
                    <Etiqueta>Cliente</Etiqueta>
                    {clientes.length === 0 ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                        No hay clientes registrados. Crea uno en la sección Clientes.
                      </p>
                    ) : (
                      <Select<number>
                        className="w-full"
                        valor={clienteSel ?? 0}
                        onChange={(id) => setClienteSel(id || null)}
                        placeholder="Selecciona un cliente…"
                        opciones={clientes.map((c) => ({
                          valor: c.id,
                          label: `${c.nombre}${c.saldo > 0 ? ` · debe ${pesos(c.saldo)}` : ''}`
                        }))}
                      />
                    )}
                    <div className="mt-2 rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-tinta-suave">
                      Se cargará <strong className="text-tinta">{pesos(neto)}</strong> a la cuenta
                      del cliente.
                    </div>
                  </div>
                )}
                </div>

                <button
                  onClick={confirmar}
                  disabled={noPuedeCobrar}
                  className="mt-4 w-full shrink-0 rounded-xl bg-acento py-3.5 text-base font-bold text-white shadow-sm transition-colors enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
                >
                  {efectivoInsuficiente
                    ? 'Monto insuficiente'
                    : mixtoInvalido
                      ? restante > 0
                        ? `Faltan ${pesos(restante)}`
                        : `Sobran ${pesos(-restante)}`
                      : metodo === 'credito'
                        ? faltaCliente
                          ? 'Selecciona un cliente'
                          : `Fiar ${pesos(neto)}`
                        : restaurante
                          ? `Cobrar e imprimir ${pesos(netoACobrar)}`
                          : `Cobrar ${pesos(netoACobrar)}`}
                </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        abierto={ticketFinal !== null}
        titulo="Ticket de cliente"
        onCerrar={() => {
          if (procesando) return
          setTicketFinal(null)
        }}
        pie={
          <>
            <button
              onClick={reimprimirCopia}
              className="btn-neutro"
            >
              <Icono nombre="imprimir" size={15} />
              Reimprimir copia
            </button>
            <button
              onClick={() => setNotaAbierto(true)}
              className="btn-neutro"
            >
              <Icono nombre="recibo" size={15} />
              Nota de venta
            </button>
            <button
              onClick={finalizar}
              disabled={procesando}
              className="btn-primario disabled:cursor-not-allowed disabled:opacity-60"
            >
              {procesando ? 'Procesando…' : 'Listo'}
            </button>
          </>
        }
      >
        {ticketFinal && (
          <TicketFinal
            titulo={ticketFinal.titulo}
            orden={ticketFinal.orden}
            copia={esCopia}
            notaVenta={notaPreview ?? undefined}
          />
        )}
      </Modal>

      <NotaVentaDialog
        abierto={notaAbierto}
        onCerrar={() => setNotaAbierto(false)}
        onImprimir={imprimirNotaVenta}
      />

      <Modal
        abierto={ticketCocina !== null}
        titulo="Reimpresión de cocina"
        onCerrar={() => setTicketCocina(null)}
        pie={
          <button
            onClick={() => setTicketCocina(null)}
            className="btn-primario"
          >
            Listo
          </button>
        }
      >
        {ticketCocina && (
          <TicketCocina titulo={ticketCocina.titulo} lineas={ticketCocina.lineas} reimpresion />
        )}
      </Modal>
    </div>
  )
}
