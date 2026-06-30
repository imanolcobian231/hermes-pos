import { useEffect, useMemo, useState } from 'react'
import type { DetalleOrden, MetodoPago, MetodoPagoOrden, OrdenConDetalle, Pago } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { TicketCocina } from '@renderer/components/TicketCocina'
import { TicketFinal } from '@renderer/components/TicketFinal'
import { useToast } from '@renderer/components/Toast'
import { useAuth } from '@renderer/store/auth'
import { useAutorizacion } from '@renderer/store/autorizacion'
import { useImpresion } from '@renderer/store/impresion'
import { comandasPorArea, rolesConfigurados } from '@renderer/lib/comandas'
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

export function Cobro({ ordenIdInicial }: Props): React.JSX.Element {
  const { mesas, ordenes, productos, categorias, clientes, cobrarOrden, fiarOrden, registrarReimpresion } =
    useDatos()
  const { usuarioActual } = useAuth()
  const { pedir } = useAutorizacion()
  const { imprimirFinal, imprimirComandas, cfg, impresoras } = useImpresion()
  const toast = useToast()

  // Etiqueta de la orden: nombre de la mesa o el rótulo del pedido para llevar.
  const etiqueta = useMemo(() => {
    const nombreMesa = (mesaId: number | null): string =>
      mesas.find((m) => m.id === mesaId)?.nombre ?? 'Mesa'
    return (o: OrdenConDetalle): string => (o.paraLlevar ? o.nombre ?? 'Para llevar' : nombreMesa(o.mesaId))
  }, [mesas])

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
  // PIN autorizado para el descuento (se valida también en el backend al cobrar).
  const [pinDescuento, setPinDescuento] = useState<string | undefined>(undefined)
  // Evita doble cobro/cargo por doble clic en "Listo".
  const [procesando, setProcesando] = useState(false)
  // Ticket final tras cobrar (modo simulación) y reimpresión de cocina.
  const [ticketFinal, setTicketFinal] = useState<{ titulo: string; orden: OrdenConDetalle } | null>(
    null
  )
  const [esCopia, setEsCopia] = useState(false)
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
    setRecibidoTexto('')
    setMixto(VACIO_MIXTO)
    setClienteSel(null)
    setPinDescuento(undefined)
  }, [ordenId])

  const orden = porCobrar.find((o) => o.id === ordenId) ?? null
  const subtotal = orden?.total ?? 0
  const descClamp = Math.max(0, Math.min(descuento, subtotal))
  const imp = calcularImpuesto(
    subtotal - descClamp,
    cfg ?? { impuestoActivo: false, impuestoTasa: 0, impuestoIncluido: true }
  )
  const neto = imp.total
  const recibido = parseFloat(recibidoTexto) || 0
  const cambio = recibido - neto

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

  const efectivoInsuficiente = metodo === 'efectivo' && recibido < neto
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
      return { pagos: [{ metodo: 'efectivo', monto: neto }], efectivoRecibido: recibido, cambio: Math.max(0, cambio) }
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
    const baseTicket = {
      ...orden,
      estado: 'cobrada' as const,
      descuento: descClamp,
      cerradoEn: new Date().toISOString()
    }
    if (metodo === 'credito') {
      setTicketFinal({
        titulo: etiqueta(orden),
        orden: { ...baseTicket, metodoPago: 'credito', pagos: [], montoRecibido: undefined, cambio: 0 }
      })
      setEsCopia(false)
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
        await cobrarOrden(snap.id, snap.pagos ?? [], snap.montoRecibido, snap.descuento, pinDescuento)
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
    setTicketCocina({ titulo: etiqueta(orden), lineas: enviadas })
    try {
      const unica = cfg?.modo === 'una' ? cfg.impresoraCajaId ?? null : null
      const { grupos } = comandasPorArea(
        enviadas,
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

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-tinta">Cobro</h1>
        <p className="text-sm text-tinta-suave">Selecciona una cuenta por cobrar y registra el pago</p>
      </header>

      {porCobrar.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
          <Icono nombre="recibo" size={40} className="text-tinta-suave/60" />
          <p className="mt-3 font-semibold">No hay cuentas por cobrar</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-6">
          {/* Lista de cuentas por cobrar */}
          <div className="flex w-72 flex-col gap-2 overflow-auto">
            {porCobrar.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrdenId(o.id)}
                className={`flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition ${
                  ordenId === o.id
                    ? 'border-acento bg-black/[0.05]'
                    : 'border-black/[0.06] bg-white hover:border-black/10'
                }`}
              >
                <span className="font-semibold text-tinta">{etiqueta(o)}</span>
                <span className="font-bold text-tinta">{pesos(o.total)}</span>
              </button>
            ))}
          </div>

          {/* Panel de cobro */}
          {orden && (
            <div className="flex flex-1 gap-6">
              {/* Detalle */}
              <div className="flex flex-1 flex-col rounded-lg border border-black/[0.06] bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-tinta">{etiqueta(orden)}</h2>
                  <button
                    onClick={reimprimirCocina}
                    className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1 text-xs font-semibold text-tinta-suave hover:bg-black/[0.05]"
                    title="Reimprimir comanda de cocina"
                  >
                    <Icono nombre="imprimir" size={14} />
                    Reimprimir cocina
                  </button>
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
                  {imp.tasa > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-tinta-suave">
                        <span>Subtotal</span>
                        <span>{pesos(imp.base)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-tinta-suave">
                        <span>IVA {imp.tasa}%</span>
                        <span>{pesos(imp.iva)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xl">
                    <span className="font-semibold text-tinta-suave">Total</span>
                    <span className="font-bold text-tinta">{pesos(neto)}</span>
                  </div>
                </div>
              </div>

              {/* Pago */}
              <div className="flex w-80 flex-col rounded-lg border border-black/[0.06] bg-white p-5">
                <span className="mb-2 text-sm font-medium text-tinta-suave">Método de pago</span>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {OPCIONES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMetodo(m.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-md border py-3 text-xs font-semibold transition ${
                        metodo === m.id
                          ? 'border-acento bg-acento text-white'
                          : 'border-black/[0.06] text-tinta-suave hover:border-black/20'
                      }`}
                    >
                      <Icono nombre={m.icono} size={20} />
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Descuento */}
                <span className="mb-2 text-sm font-medium text-tinta-suave">Descuento</span>
                <div className="mb-2 flex flex-wrap gap-2">
                  {[0, 10, 15, 20].map((p) => {
                    const monto = p === 0 ? 0 : Math.round(subtotal * p) / 100
                    const activo = descClamp === monto && (p !== 0 || descClamp === 0)
                    return (
                      <button
                        key={p}
                        onClick={() => setDescuento(monto)}
                        className={`rounded-md border px-3 py-1 text-sm font-semibold transition ${
                          activo
                            ? 'border-acento bg-acento text-white'
                            : 'border-black/[0.06] text-tinta-suave hover:border-black/20'
                        }`}
                      >
                        {p === 0 ? 'Sin' : `${p}%`}
                      </button>
                    )
                  })}
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-tinta-suave">$</span>
                    <input
                      type="number"
                      value={descuento || ''}
                      onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="Otro"
                      className="w-20 rounded-md border border-black/10 px-2 py-1 text-right text-sm outline-none focus:border-acento"
                    />
                  </div>
                </div>
                {descClamp > 0 && (
                  <div className="mb-3 flex justify-between rounded-md bg-black/[0.03] px-3 py-2 text-sm">
                    <span className="text-tinta-suave">Descuento</span>
                    <span className="font-semibold text-tinta">−{pesos(descClamp)}</span>
                  </div>
                )}

                {metodo === 'efectivo' && (
                  <>
                    <span className="mb-2 text-sm font-medium text-tinta-suave">Monto recibido</span>
                    <input
                      type="number"
                      value={recibidoTexto}
                      onChange={(e) => setRecibidoTexto(e.target.value)}
                      placeholder="0.00"
                      className="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-right text-lg font-semibold outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                    />
                    <div className="mb-3 flex flex-wrap gap-2">
                      {RAPIDOS.map((v) => (
                        <button
                          key={v}
                          onClick={() => setRecibidoTexto(String(v))}
                          className="rounded-lg bg-black/[0.05] px-3 py-1 text-sm font-semibold text-tinta-suave hover:bg-black/[0.08]"
                        >
                          ${v}
                        </button>
                      ))}
                      <button
                        onClick={() => setRecibidoTexto(String(neto))}
                        className="rounded-lg bg-black/[0.05] px-3 py-1 text-sm font-semibold text-tinta-suave hover:bg-black/[0.08]"
                      >
                        Exacto
                      </button>
                    </div>
                    <div className="mb-4 flex justify-between rounded-lg bg-black/[0.03] px-4 py-3">
                      <span className="font-semibold text-tinta-suave">Cambio</span>
                      <span
                        className={`text-xl font-bold ${cambio < 0 ? 'text-red-600' : 'text-tinta'}`}
                      >
                        {pesos(Math.max(0, cambio))}
                      </span>
                    </div>
                  </>
                )}

                {metodo === 'mixto' && (
                  <>
                    <span className="mb-2 text-sm font-medium text-tinta-suave">Reparte el pago</span>
                    <div className="mb-2 flex flex-col gap-2">
                      {METODOS.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="flex w-24 items-center gap-1.5 text-sm text-tinta-suave">
                            <Icono nombre={m.icono} size={15} />
                            {m.label}
                          </span>
                          <span className="text-sm text-tinta-suave">$</span>
                          <input
                            type="number"
                            value={mixto[m.id]}
                            onChange={(e) => setMixto((s) => ({ ...s, [m.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-24 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-right text-sm outline-none focus:border-acento"
                          />
                          <button
                            type="button"
                            onClick={() => ponerResto(m.id)}
                            className="rounded-md border border-black/[0.06] px-2 py-1 text-xs font-semibold text-tinta-suave hover:bg-black/[0.05]"
                            title="Asignar lo que falta a este método"
                          >
                            resto
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mb-4 flex justify-between rounded-lg bg-black/[0.03] px-4 py-3">
                      <span className="font-semibold text-tinta-suave">
                        {restante > 0 ? 'Falta' : restante < 0 ? 'Sobra' : 'Restante'}
                      </span>
                      <span
                        className={`text-xl font-bold ${
                          Math.abs(restante) < 0.01 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {pesos(Math.abs(restante))}
                      </span>
                    </div>
                  </>
                )}

                {metodo === 'credito' && (
                  <>
                    <span className="mb-2 text-sm font-medium text-tinta-suave">Cliente</span>
                    {clientes.length === 0 ? (
                      <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        No hay clientes registrados. Crea uno en la sección Clientes.
                      </p>
                    ) : (
                      <select
                        value={clienteSel ?? ''}
                        onChange={(e) => setClienteSel(e.target.value ? Number(e.target.value) : null)}
                        className="mb-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-acento"
                      >
                        <option value="">Selecciona un cliente…</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                            {c.saldo > 0 ? ` · debe ${pesos(c.saldo)}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="mb-4 rounded-lg bg-black/[0.03] px-4 py-3 text-sm text-tinta-suave">
                      Se cargará <strong className="text-tinta">{pesos(neto)}</strong> a la cuenta
                      del cliente.
                    </div>
                  </>
                )}

                <button
                  onClick={confirmar}
                  disabled={noPuedeCobrar}
                  className="mt-auto w-full rounded-md bg-acento py-3 font-bold text-white transition enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
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
                        : `Cobrar ${pesos(neto)}`}
                </button>
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
              className="flex items-center gap-1.5 rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              <Icono nombre="imprimir" size={15} />
              Reimprimir copia
            </button>
            <button
              onClick={finalizar}
              disabled={procesando}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {procesando ? 'Procesando…' : 'Listo'}
            </button>
          </>
        }
      >
        {ticketFinal && (
          <TicketFinal titulo={ticketFinal.titulo} orden={ticketFinal.orden} copia={esCopia} />
        )}
      </Modal>

      <Modal
        abierto={ticketCocina !== null}
        titulo="Reimpresión de cocina"
        onCerrar={() => setTicketCocina(null)}
        pie={
          <button
            onClick={() => setTicketCocina(null)}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
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
