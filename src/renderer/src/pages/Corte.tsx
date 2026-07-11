import { useState } from 'react'
import type { Corte as TipoCorte, MetodoPago, OrdenConDetalle } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { useImpresion } from '@renderer/store/impresion'
import { fechaHora, hora, pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toast'
import { useAuth } from '@renderer/store/auth'
import { useAutorizacion } from '@renderer/store/autorizacion'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { EncabezadoPagina } from '@renderer/components/Pagina'
import { Select } from '@renderer/components/Select'

export function Corte(): React.JSX.Element {
  const { cortes, reimpresiones, cancelaciones, gastos: gastosTurno, resumen, cobradas, caja, abrirCaja, agregarGasto, eliminarGasto, devolverOrden, cambiarMetodoPago, cerrarCorte } =
    useDatos()
  const toast = useToast()
  const { usuarioActual } = useAuth()
  const { pedir } = useAutorizacion()
  const { imprimirCorte } = useImpresion()
  const [confirmar, setConfirmar] = useState(false)
  const [fondo, setFondo] = useState('')
  const [contado, setContado] = useState('')
  // Imprimir el ticket del corte al cerrar (opcional, recordado entre cierres).
  const [imprimirAlCerrar, setImprimirAlCerrar] = useState(true)
  // Apertura de caja.
  const [abriendo, setAbriendo] = useState(false)
  const [fondoApertura, setFondoApertura] = useState('')
  // Alta de gasto/retiro desde el corte (antes vivía en Finanzas, ya fusionado).
  const [gastoConcepto, setGastoConcepto] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoTipo, setGastoTipo] = useState<'gasto' | 'retiro'>('gasto')
  // Devolución de una venta.
  const [devolviendo, setDevolviendo] = useState<OrdenConDetalle | null>(null)
  const [motivoDev, setMotivoDev] = useState('')

  const nombreOrden = (ordenId: number): string => `Orden #${ordenId}`

  const efectivo = resumen.totalEfectivo
  const tarjeta = resumen.totalTarjeta
  const transferencia = resumen.totalTransferencia
  const gastos = resumen.totalGastos
  const retiros = resumen.totalRetiros
  const propinas = resumen.totalPropinas
  // "Ventas" = cobrado por productos, SIN propinas (la propina no es venta del
  // negocio; se muestra aparte). El efectivo del cajón sí las incluye, por eso el
  // cuadre usa `efectivo` completo y no este total.
  const total = efectivo + tarjeta + transferencia - propinas
  // El balance (utilidad del turno) resta gastos, NO retiros (el retiro es efectivo
  // que salió del cajón, no un gasto del negocio).
  const balance = total - gastos
  const numOrdenes = resumen.numOrdenes

  // Cuadre de caja: efectivo que debería haber en el cajón y diferencia con el
  // conteo físico (+ sobrante, − faltante). El fondo y el conteo son opcionales.
  const fondoNum = Number(fondo) || 0
  const contadoNum = contado.trim() === '' ? undefined : Number(contado) || 0
  // El efectivo esperado sí resta gastos Y retiros (ambos salieron del cajón).
  const efectivoEsperado = fondoNum + efectivo - gastos - retiros
  const diferencia = contadoNum != null ? contadoNum - efectivoEsperado : null

  const abrirCierre = (): void => {
    // Prefill del fondo con el de la apertura de caja (si hay turno abierto).
    setFondo(caja.abierta ? String(caja.fondoInicial) : '')
    setContado('')
    setConfirmar(true)
  }

  const confirmarApertura = async (): Promise<void> => {
    await abrirCaja(Number(fondoApertura) || 0)
    setAbriendo(false)
    setFondoApertura('')
    toast('Caja abierta', 'info')
  }

  const confirmarCierre = async (): Promise<void> => {
    const corte = await cerrarCorte({ fondoInicial: fondoNum, efectivoContado: contadoNum })
    setConfirmar(false)
    const ventas =
      corte.totalEfectivo + corte.totalTarjeta + corte.totalTransferencia - corte.totalPropinas
    const dif = corte.diferencia
    const sufijo =
      dif != null && Math.abs(dif) >= 0.01
        ? ` · ${dif < 0 ? 'faltante' : 'sobrante'} ${pesos(Math.abs(dif))}`
        : ''
    toast(`Turno cerrado · balance ${pesos(ventas - corte.totalGastos)}${sufijo}`)
    // Impresión opcional del ticket. Un fallo no debe tirar el cierre: el turno
    // ya quedó cerrado, solo avisamos.
    if (imprimirAlCerrar) {
      try {
        await imprimirCorte(corte)
      } catch (e) {
        toast(e instanceof Error ? e.message : 'No se pudo imprimir el corte', 'error')
      }
    }
  }

  const reimprimirCorte = async (corte: TipoCorte): Promise<void> => {
    try {
      await imprimirCorte(corte)
      toast('Corte reimpreso', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo imprimir el corte', 'error')
    }
  }

  const confirmarDevolucion = (): void => {
    if (!devolviendo) return
    const id = devolviendo.id
    const m = motivoDev.trim()
    if (!m) return
    pedir((pin) => {
      void (async () => {
        try {
          await devolverOrden(id, m, usuarioActual?.nombre, pin)
          toast('Venta devuelta', 'info')
        } catch (e) {
          toast(e instanceof Error ? e.message : 'No se pudo devolver', 'error')
        }
      })()
      setDevolviendo(null)
      setMotivoDev('')
    }, 'Devolver una venta')
  }

  const netoOrden = (o: OrdenConDetalle): number => o.total - o.descuento

  const agregarGastoTurno = async (): Promise<void> => {
    const c = gastoConcepto.trim()
    const m = Number(gastoMonto)
    if (!c || !m || m <= 0) return
    await agregarGasto(c, m, gastoTipo)
    setGastoConcepto('')
    setGastoMonto('')
    toast(gastoTipo === 'retiro' ? 'Retiro registrado' : 'Gasto registrado')
  }

  // Corrige el método de pago de una venta del turno (ej. se asumió efectivo pero
  // el cliente pagó con tarjeta). Solo aplica a efectivo/tarjeta/transferencia.
  const editarMetodo = async (ordenId: number, metodo: MetodoPago): Promise<void> => {
    try {
      await cambiarMetodoPago(ordenId, metodo)
      toast('Método de pago actualizado', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cambiar el método', 'error')
    }
  }

  return (
    <div>
      <EncabezadoPagina titulo="Finanzas" subtitulo="Caja, ventas, gastos y cierre del turno">
        {caja.abierta ? (
          <button
            onClick={abrirCierre}
            disabled={numOrdenes === 0}
            title={numOrdenes === 0 ? 'No hay ventas en el turno' : ''}
            className="btn-primario disabled:bg-black/10 disabled:text-tinta-suave/50"
          >
            <Icono nombre="corte" size={16} />
            Cerrar turno
          </button>
        ) : (
          <button
            onClick={() => {
              setFondoApertura('')
              setAbriendo(true)
            }}
            className="btn-primario"
          >
            <Icono nombre="mas" size={16} />
            Abrir caja
          </button>
        )}
      </EncabezadoPagina>

      {/* Estado de la caja (apertura con fondo) */}
      <div
        className={`mb-6 flex items-center justify-between rounded-2xl border px-5 py-3.5 ${
          caja.abierta
            ? 'border-acento/20 bg-acento/[0.05]'
            : 'border-black/[0.08] bg-black/[0.02]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              caja.abierta ? 'bg-acento/10 text-acento' : 'bg-black/[0.06] text-tinta-suave'
            }`}
          >
            <Icono nombre="corte" size={18} />
          </span>
          <div className="text-sm">
            {caja.abierta ? (
              <span className="text-tinta">
                Caja <strong>abierta</strong> · fondo <strong>{pesos(caja.fondoInicial)}</strong>
                {caja.abiertoEn ? ` · desde ${hora(caja.abiertoEn)}` : ''}
              </span>
            ) : (
              <span className="text-tinta-suave">
                Caja <strong className="text-tinta">cerrada</strong> — ábrela con su fondo de cambio al
                iniciar el turno.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resumen del turno — estilo hoja de corte (distinto al panel de Reportes) */}
      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {/* Balance destacado */}
        <div className="flex flex-col rounded-2xl border border-acento/20 bg-acento/[0.05] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-acento">
            <Icono nombre="corte" size={16} /> Balance del turno
          </div>
          <div
            className={`mt-3 text-[2.6rem] font-bold leading-none tabular-nums tracking-tight ${
              balance < 0 ? 'text-red-600' : 'text-tinta'
            }`}
          >
            {pesos(balance)}
          </div>
          <div className="mt-auto flex gap-8 pt-6 text-sm">
            <div>
              <div className="text-xs text-tinta-suave">Ventas</div>
              <div className="font-semibold tabular-nums text-tinta">{pesos(total)}</div>
            </div>
            <div>
              <div className="text-xs text-tinta-suave">{numOrdenes === 1 ? 'Orden' : 'Órdenes'}</div>
              <div className="font-semibold tabular-nums text-tinta">{numOrdenes}</div>
            </div>
          </div>
        </div>

        {/* Desglose del turno (hoja de corte) */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-1 text-sm font-bold text-tinta">Desglose del turno</div>
          <div className="grid gap-x-10 sm:grid-flow-col sm:grid-rows-3">
            <FilaCorte icono="efectivo" label="Efectivo" valor={pesos(efectivo)} />
            <FilaCorte icono="tarjeta" label="Tarjeta" valor={pesos(tarjeta)} />
            <FilaCorte icono="transferencia" label="Transferencia" valor={pesos(transferencia)} />
            <FilaCorte icono="finanzas" label="Propinas" valor={pesos(propinas)} tono="verde" />
            <FilaCorte icono="gasto" label="Gastos" valor={pesos(gastos)} tono="rojo" signo="−" />
            <FilaCorte icono="corte" label="Retiros" valor={pesos(retiros)} tono="rojo" signo="−" />
          </div>
        </div>
      </section>

      {/* Ventas del turno (con opción de devolver) */}
      {cobradas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-tinta">Ventas del turno</h2>
          <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/95 text-left text-xs uppercase tracking-wider text-tinta-suave backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Hora</th>
                    <th className="px-4 py-2.5 font-semibold">Orden</th>
                    <th className="px-4 py-2.5 font-semibold">Método</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
              <tbody>
                {cobradas.map((o) => (
                  <tr key={o.id} className="border-t border-black/[0.04]">
                    <td className="px-4 py-2 text-tinta-suave">{hora(o.cerradoEn)}</td>
                    <td className="px-4 py-2 text-tinta">
                      {o.paraLlevar ? o.nombre ?? 'Para llevar' : nombreOrden(o.id)}
                    </td>
                    <td className="px-4 py-2 text-tinta-suave">
                      {o.metodoPago === 'efectivo' ||
                      o.metodoPago === 'tarjeta' ||
                      o.metodoPago === 'transferencia' ? (
                        <Select<MetodoPago>
                          size="sm"
                          valor={o.metodoPago}
                          onChange={(m) => void editarMetodo(o.id, m)}
                          opciones={[
                            { valor: 'efectivo', label: 'Efectivo' },
                            { valor: 'tarjeta', label: 'Tarjeta' },
                            { valor: 'transferencia', label: 'Transferencia' }
                          ]}
                        />
                      ) : (
                        <span className="capitalize">
                          {o.metodoPago === 'credito'
                            ? 'Crédito'
                            : o.metodoPago === 'mixto'
                              ? 'Mixto'
                              : o.metodoPago ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-tinta">
                      {pesos(netoOrden(o))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setMotivoDev('')
                          setDevolviendo(o)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 active:scale-95"
                      >
                        <Icono nombre="recargar" size={12} />
                        Devolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>
      )}

      {/* Gastos y retiros del turno (salidas de efectivo del cajón) */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-tinta">Gastos y retiros del turno</h2>
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          {/* Alta de gasto o retiro */}
          <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.04] p-4">
            <div className="flex rounded-lg bg-black/[0.04] p-1">
              {(['gasto', 'retiro'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setGastoTipo(t)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    gastoTipo === t
                      ? 'bg-white text-acento shadow-sm'
                      : 'text-tinta-suave hover:text-tinta'
                  }`}
                >
                  {t === 'gasto' ? 'Gasto' : 'Retiro'}
                </button>
              ))}
            </div>
            <input
              value={gastoConcepto}
              maxLength={40}
              onChange={(e) => setGastoConcepto(e.target.value)}
              placeholder={
                gastoTipo === 'retiro' ? 'Concepto (ej. depósito banco)' : 'Concepto (ej. hielo, gas)'
              }
              className="min-w-[8rem] flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition focus:border-acento focus:ring-2 focus:ring-acento/15"
            />
            <div className="flex items-center rounded-lg border border-black/10 px-3 transition focus-within:border-acento focus-within:ring-2 focus-within:ring-acento/15">
              <span className="text-sm text-tinta-suave">$</span>
              <input
                type="number"
                value={gastoMonto}
                onChange={(e) => setGastoMonto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agregarGastoTurno()}
                placeholder="0.00"
                className="w-24 bg-transparent py-2 pl-1 text-right text-sm font-semibold outline-none"
              />
            </div>
            <button onClick={() => void agregarGastoTurno()} className="btn-primario shrink-0">
              <Icono nombre="mas" size={16} />
              Agregar
            </button>
          </div>

          {/* Lista de movimientos */}
          {gastosTurno.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-tinta-suave">
              Sin gastos ni retiros en el turno
            </p>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {gastosTurno.map((g) => (
                    <tr
                      key={g.id}
                      className="group border-b border-black/[0.04] transition last:border-0 hover:bg-black/[0.02]"
                    >
                      <td className="px-4 py-2 text-tinta-suave">{hora(g.fecha)}</td>
                      <td className="px-4 py-2 text-tinta">
                        {g.concepto}
                        {g.tipo === 'retiro' && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            Retiro
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-600">
                        −{pesos(g.monto)}
                      </td>
                      <td className="w-8 px-2 py-2 text-right">
                        <button
                          onClick={() => {
                            void eliminarGasto(g.id)
                            toast('Movimiento eliminado', 'info')
                          }}
                          className="rounded-lg p-1.5 text-tinta-suave/60 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label="Eliminar"
                        >
                          <Icono nombre="eliminar" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-black/[0.08] bg-black/[0.02]">
                  <tr>
                    <td className="px-4 py-2 font-semibold text-tinta" colSpan={2}>
                      Total de gastos (baja del balance)
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-red-600" colSpan={2}>
                      −{pesos(gastos)}
                    </td>
                  </tr>
                  {retiros > 0 && (
                    <tr>
                      <td className="px-4 py-2 font-semibold text-tinta" colSpan={2}>
                        Total de retiros (solo baja el efectivo)
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-red-600" colSpan={2}>
                        −{pesos(retiros)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Historial */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-tinta">Historial de cortes</h2>
        {cortes.length === 0 ? (
          <p className="text-sm text-tinta-suave">Aún no se ha cerrado ningún turno.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Efectivo</th>
                  <th className="px-4 py-2.5 text-right">Tarjeta</th>
                  <th className="px-4 py-2.5 text-right">Transfer.</th>
                  <th className="px-4 py-2.5 text-right">Ventas</th>
                  <th className="px-4 py-2.5 text-right">Gastos</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                  <th className="px-4 py-2.5 text-right">Cuadre</th>
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody>
                {cortes.map((c) => {
                  const ventas =
                    c.totalEfectivo + c.totalTarjeta + c.totalTransferencia - c.totalPropinas
                  return (
                    <tr key={c.id} className="border-t border-black/[0.04]">
                      <td className="px-4 py-2.5 text-tinta-suave">{fechaHora(c.cerradoEn)}</td>
                      <td className="px-4 py-2.5 text-right">{pesos(c.totalEfectivo)}</td>
                      <td className="px-4 py-2.5 text-right">{pesos(c.totalTarjeta)}</td>
                      <td className="px-4 py-2.5 text-right">{pesos(c.totalTransferencia)}</td>
                      <td className="px-4 py-2.5 text-right text-tinta">{pesos(ventas)}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">
                        {c.totalGastos > 0 ? `−${pesos(c.totalGastos)}` : pesos(0)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-tinta">
                        {pesos(ventas - c.totalGastos)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.diferencia == null ? (
                          <span className="text-tinta-suave/60">—</span>
                        ) : Math.abs(c.diferencia) < 0.01 ? (
                          <span className="font-semibold text-acento">Cuadra</span>
                        ) : (
                          <span
                            className={`font-semibold ${c.diferencia < 0 ? 'text-red-600' : 'text-amber-600'}`}
                          >
                            {c.diferencia < 0 ? '−' : '+'}
                            {pesos(Math.abs(c.diferencia))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => void reimprimirCorte(c)}
                          title="Reimprimir ticket del corte"
                          className="rounded-md border border-black/10 px-2.5 py-1 text-xs font-semibold text-tinta-suave hover:bg-black/[0.04]"
                        >
                          <Icono nombre="recibo" size={13} className="mr-1 inline" />
                          Ticket
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Auditoría de reimpresiones del turno */}
      {reimpresiones.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-tinta">Reimpresiones del turno</h2>
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
                <tr>
                  <th className="px-4 py-2.5">Hora</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Mesa / Orden</th>
                  <th className="px-4 py-2.5">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {reimpresiones.map((r) => (
                  <tr key={r.id} className="border-t border-black/[0.04]">
                    <td className="px-4 py-2.5 text-tinta-suave">{hora(r.reimprimirEn)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          r.tipo === 'cocina'
                            ? 'bg-black/[0.05] text-tinta'
                            : 'bg-acento text-white'
                        }`}
                      >
                        {r.tipo === 'cocina' ? 'Cocina' : 'Ticket final'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-tinta">{nombreOrden(r.ordenId)}</td>
                    <td className="px-4 py-2.5 text-tinta-suave">{r.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Auditoría de cancelaciones del turno */}
      {cancelaciones.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-tinta">Cancelaciones y devoluciones del turno</h2>
          <div className="overflow-x-auto rounded-xl border border-black/[0.06] bg-white">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
                <tr>
                  <th className="px-4 py-2.5">Hora</th>
                  <th className="px-4 py-2.5">Orden</th>
                  <th className="px-4 py-2.5">Motivo</th>
                  <th className="px-4 py-2.5">Usuario</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {cancelaciones.map((c) => (
                  <tr key={c.id} className="border-t border-black/[0.04]">
                    <td className="px-4 py-2.5 text-tinta-suave">{hora(c.canceladoEn)}</td>
                    <td className="px-4 py-2.5 text-tinta">{nombreOrden(c.ordenId)}</td>
                    <td className="px-4 py-2.5 text-tinta">{c.motivo}</td>
                    <td className="px-4 py-2.5 text-tinta-suave">{c.usuario}</td>
                    <td className="px-4 py-2.5 text-right text-tinta">{pesos(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        abierto={confirmar}
        titulo="Cerrar turno"
        onCerrar={() => setConfirmar(false)}
        pie={
          <>
            <button
              onClick={() => setConfirmar(false)}
              className="btn-texto"
            >
              Cancelar
            </button>
            <button
              onClick={() => void confirmarCierre()}
              className="btn-primario"
            >
              Cerrar turno
            </button>
          </>
        }
      >
        <p className="text-sm text-tinta-suave">
          Ventas <strong>{pesos(total)}</strong> − gastos <strong>{pesos(gastos)}</strong> ={' '}
          <strong>{pesos(balance)}</strong> de balance ({numOrdenes} órdenes).
        </p>

        {/* Cuadre de caja (opcional pero recomendado) */}
        <div className="mt-4 rounded-lg border border-black/[0.06] bg-black/[0.03] p-4">
          <h3 className="mb-3 text-sm font-bold text-tinta">Cuadre de caja (efectivo)</h3>
          <div className="grid grid-cols-2 gap-3">
            <CampoMonto
              label="Fondo inicial"
              ayuda="Cambio con el que abriste"
              valor={fondo}
              onChange={setFondo}
            />
            <CampoMonto
              label="Efectivo contado"
              ayuda="Lo que hay en el cajón"
              valor={contado}
              onChange={setContado}
            />
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-tinta-suave">
              <span>Efectivo esperado en cajón</span>
              <span className="font-semibold">{pesos(efectivoEsperado)}</span>
            </div>
            {diferencia != null && (
              <div
                className={`flex justify-between font-bold ${
                  Math.abs(diferencia) < 0.01
                    ? 'text-acento'
                    : diferencia < 0
                      ? 'text-red-600'
                      : 'text-amber-600'
                }`}
              >
                <span>
                  {Math.abs(diferencia) < 0.01
                    ? 'Cuadra'
                    : diferencia < 0
                      ? 'Faltante'
                      : 'Sobrante'}
                </span>
                <span>
                  {diferencia < 0 ? '−' : diferencia > 0 ? '+' : ''}
                  {pesos(Math.abs(diferencia))}
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-tinta-suave">
            Esperado = fondo + efectivo cobrado (propinas incluidas) − gastos − retiros. Déjalos
            vacíos para omitir el cuadre.
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-black/[0.06] bg-white px-3 py-2.5">
          <input
            type="checkbox"
            checked={imprimirAlCerrar}
            onChange={(e) => setImprimirAlCerrar(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-tinta">
            Imprimir ticket del corte
            <span className="block text-xs text-tinta-suave">
              En la impresora de Caja. Siempre puedes reimprimirlo desde el historial.
            </span>
          </span>
        </label>

        <p className="mt-4 text-xs text-tinta-suave">
          Se cerrará el turno e iniciará uno nuevo. Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Abrir caja */}
      <Modal
        abierto={abriendo}
        titulo="Abrir caja"
        onCerrar={() => setAbriendo(false)}
        pie={
          <>
            <button
              onClick={() => setAbriendo(false)}
              className="btn-texto"
            >
              Cancelar
            </button>
            <button
              onClick={() => void confirmarApertura()}
              className="btn-primario"
            >
              Abrir caja
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-tinta-suave">
          Captura el efectivo (fondo de cambio) con el que inicias el turno. Se usará para el cuadre
          al cerrar.
        </p>
        <CampoMonto label="Fondo inicial" valor={fondoApertura} onChange={setFondoApertura} />
      </Modal>

      {/* Devolución de venta */}
      <Modal
        abierto={devolviendo !== null}
        titulo="Devolver venta"
        onCerrar={() => {
          setDevolviendo(null)
          setMotivoDev('')
        }}
        pie={
          <>
            <button
              onClick={() => {
                setDevolviendo(null)
                setMotivoDev('')
              }}
              className="btn-texto"
            >
              Cancelar
            </button>
            <button onClick={confirmarDevolucion} disabled={!motivoDev.trim()} className="btn-peligro">
              Devolver
            </button>
          </>
        }
      >
        {devolviendo && (
          <>
            <p className="text-sm text-tinta-suave">
              Se devolverá{' '}
              <strong>
                {devolviendo.paraLlevar ? devolviendo.nombre ?? 'Para llevar' : nombreOrden(devolviendo.id)}
              </strong>{' '}
              por <strong>{pesos(netoOrden(devolviendo))}</strong>. Sale de los ingresos del turno
              {devolviendo.metodoPago === 'credito' ? ' y se revierte el cargo al cliente' : ''}.
            </p>
            <label className="mb-1 mt-4 block text-sm font-medium text-tinta-suave">Motivo</label>
            <input
              autoFocus
              value={motivoDev}
              onChange={(e) => setMotivoDev(e.target.value)}
              placeholder="Ej. producto en mal estado, error de cobro…"
              className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
            />
            <p className="mt-2 text-xs text-tinta-suave">Queda registrado en el corte para auditoría.</p>
          </>
        )}
      </Modal>
    </div>
  )
}

// Renglón del desglose del turno (hoja de corte): ícono + etiqueta y monto, con
// separador punteado. `tono` colorea el monto (propinas verde, salidas rojo).
function FilaCorte({
  icono,
  label,
  valor,
  tono,
  signo
}: {
  icono: NombreIcono
  label: string
  valor: string
  tono?: 'verde' | 'rojo'
  signo?: string
}): React.JSX.Element {
  const color = tono === 'verde' ? 'text-emerald-600' : tono === 'rojo' ? 'text-red-600' : 'text-tinta'
  return (
    <div className="flex items-center justify-between border-b border-dashed border-black/[0.08] py-2.5">
      <span className="flex items-center gap-2 text-tinta-suave">
        <Icono nombre={icono} size={14} /> {label}
      </span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {signo}
        {valor}
      </span>
    </div>
  )
}

function CampoMonto({
  label,
  ayuda,
  valor,
  onChange
}: {
  label: string
  ayuda?: string
  valor: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-tinta-suave">{label}</label>
      <div className="flex items-center rounded-lg border border-black/10 bg-white px-2 focus-within:border-acento">
        <span className="text-sm text-tinta-suave">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent px-1 py-2 text-right text-sm outline-none"
        />
      </div>
      {ayuda && <p className="mt-0.5 text-[11px] text-tinta-suave">{ayuda}</p>}
    </div>
  )
}
