import { useEffect, useMemo, useState } from 'react'
import type { DetalleOrden, MetodoPago, OrdenConDetalle } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { TicketCocina } from '@renderer/components/TicketCocina'
import { TicketFinal } from '@renderer/components/TicketFinal'
import { useToast } from '@renderer/components/Toast'
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

const RAPIDOS = [50, 100, 200, 500]

export function Cobro({ ordenIdInicial }: Props): React.JSX.Element {
  const { mesas, ordenes, cobrarOrden, registrarReimpresion } = useDatos()
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
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [recibidoTexto, setRecibidoTexto] = useState('')
  const [descuento, setDescuento] = useState(0)
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

  // Al cambiar de cuenta, reinicia descuento y monto recibido.
  useEffect(() => {
    setDescuento(0)
    setRecibidoTexto('')
  }, [ordenId])

  const orden = porCobrar.find((o) => o.id === ordenId) ?? null
  const subtotal = orden?.total ?? 0
  const descClamp = Math.max(0, Math.min(descuento, subtotal))
  const neto = subtotal - descClamp
  const recibido = parseFloat(recibidoTexto) || 0
  const cambio = recibido - neto
  const efectivoInsuficiente = metodo === 'efectivo' && recibido < neto

  // Muestra el ticket como vista previa. El cobro NO se confirma aquí: se
  // confirma al dar "Listo" (finalizar).
  const confirmar = (): void => {
    if (!orden) return
    const montoFinal = metodo === 'efectivo' ? recibido : neto
    setTicketFinal({
      titulo: etiqueta(orden),
      orden: {
        ...orden,
        estado: 'cobrada',
        descuento: descClamp,
        metodoPago: metodo,
        montoRecibido: montoFinal,
        cambio: metodo === 'efectivo' ? Math.max(0, montoFinal - neto) : 0,
        cerradoEn: new Date().toISOString()
      }
    })
    setEsCopia(false)
  }

  // Confirma el cobro (cierra la venta) al dar "Listo".
  const finalizar = (): void => {
    if (!ticketFinal) return
    const snap = ticketFinal.orden
    const netoSnap = snap.total - snap.descuento
    void cobrarOrden(
      snap.id,
      snap.metodoPago ?? 'efectivo',
      snap.montoRecibido ?? netoSnap,
      snap.descuento
    )
    toast(`${ticketFinal.titulo} cobrada · ticket impreso`)
    setTicketFinal(null)
    setRecibidoTexto('')
    setMetodo('efectivo')
    setDescuento(0)
    setOrdenId(null)
  }

  const reimprimirCocina = (): void => {
    if (!orden) return
    const enviadas = orden.detalle.filter((d) => d.enviadoCocina)
    if (enviadas.length === 0) return
    registrarReimpresion('cocina', orden.id)
    setTicketCocina({ titulo: etiqueta(orden), lineas: enviadas })
    toast('Comanda de cocina reimpresa', 'info')
  }

  const reimprimirCopia = (): void => {
    if (!ticketFinal) return
    registrarReimpresion('final', ticketFinal.orden.id)
    setEsCopia(true)
    toast('Copia del ticket reimpresa', 'info')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cobro</h1>
        <p className="text-sm text-slate-500">Selecciona una cuenta por cobrar y registra el pago</p>
      </header>

      {porCobrar.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
          <Icono nombre="recibo" size={40} className="text-slate-300" />
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
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="font-semibold text-slate-800">{etiqueta(o)}</span>
                <span className="font-bold text-slate-700">{pesos(o.total)}</span>
              </button>
            ))}
          </div>

          {/* Panel de cobro */}
          {orden && (
            <div className="flex flex-1 gap-6">
              {/* Detalle */}
              <div className="flex flex-1 flex-col rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">{etiqueta(orden)}</h2>
                  <button
                    onClick={reimprimirCocina}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
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
                        <span className="text-slate-600">
                          {d.cantidad}× {d.nombreProducto}
                        </span>
                        <span className="font-medium text-slate-700">
                          {pesos(d.cantidad * d.precioUnitario)}
                        </span>
                      </div>
                      {d.modificadores.map((m) => (
                        <div key={m.id} className="pl-4 text-xs text-slate-400">
                          + {m.nombre}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {descClamp > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>{pesos(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Descuento</span>
                        <span>−{pesos(descClamp)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xl">
                    <span className="font-semibold text-slate-600">Total</span>
                    <span className="font-bold text-slate-900">{pesos(neto)}</span>
                  </div>
                </div>
              </div>

              {/* Pago */}
              <div className="flex w-80 flex-col rounded-lg border border-slate-200 bg-white p-5">
                <span className="mb-2 text-sm font-medium text-slate-600">Método de pago</span>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {METODOS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMetodo(m.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-md border py-3 text-xs font-semibold transition ${
                        metodo === m.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <Icono nombre={m.icono} size={20} />
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Descuento */}
                <span className="mb-2 text-sm font-medium text-slate-600">Descuento</span>
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
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {p === 0 ? 'Sin' : `${p}%`}
                      </button>
                    )
                  })}
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      value={descuento || ''}
                      onChange={(e) => setDescuento(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="Otro"
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
                {descClamp > 0 && (
                  <div className="mb-3 flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-500">Descuento</span>
                    <span className="font-semibold text-slate-700">−{pesos(descClamp)}</span>
                  </div>
                )}

                {metodo === 'efectivo' && (
                  <>
                    <span className="mb-2 text-sm font-medium text-slate-600">Monto recibido</span>
                    <input
                      type="number"
                      value={recibidoTexto}
                      onChange={(e) => setRecibidoTexto(e.target.value)}
                      placeholder="0.00"
                      className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-lg font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <div className="mb-3 flex flex-wrap gap-2">
                      {RAPIDOS.map((v) => (
                        <button
                          key={v}
                          onClick={() => setRecibidoTexto(String(v))}
                          className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          ${v}
                        </button>
                      ))}
                      <button
                        onClick={() => setRecibidoTexto(String(neto))}
                        className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Exacto
                      </button>
                    </div>
                    <div className="mb-4 flex justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="font-semibold text-slate-600">Cambio</span>
                      <span
                        className={`text-xl font-bold ${cambio < 0 ? 'text-red-600' : 'text-slate-900'}`}
                      >
                        {pesos(Math.max(0, cambio))}
                      </span>
                    </div>
                  </>
                )}

                <button
                  onClick={confirmar}
                  disabled={efectivoInsuficiente}
                  className="mt-auto w-full rounded-md bg-slate-900 py-3 font-bold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {efectivoInsuficiente ? 'Monto insuficiente' : `Cobrar ${pesos(neto)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        abierto={ticketFinal !== null}
        titulo="Ticket de cliente"
        onCerrar={() => setTicketFinal(null)}
        pie={
          <>
            <button
              onClick={reimprimirCopia}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Icono nombre="imprimir" size={15} />
              Reimprimir copia
            </button>
            <button
              onClick={finalizar}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Listo
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
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
