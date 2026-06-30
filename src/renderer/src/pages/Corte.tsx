import { useState } from 'react'
import type { Corte as TipoCorte, OrdenConDetalle } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { useImpresion } from '@renderer/store/impresion'
import { fechaHora, hora, pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toast'
import { useAuth } from '@renderer/store/auth'
import { useAutorizacion } from '@renderer/store/autorizacion'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

export function Corte(): React.JSX.Element {
  const { cortes, reimpresiones, cancelaciones, resumen, cobradas, caja, abrirCaja, devolverOrden, cerrarCorte } =
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
  // Devolución de una venta.
  const [devolviendo, setDevolviendo] = useState<OrdenConDetalle | null>(null)
  const [motivoDev, setMotivoDev] = useState('')

  const nombreOrden = (ordenId: number): string => `Orden #${ordenId}`

  const efectivo = resumen.totalEfectivo
  const tarjeta = resumen.totalTarjeta
  const transferencia = resumen.totalTransferencia
  const total = efectivo + tarjeta + transferencia
  const gastos = resumen.totalGastos
  const balance = total - gastos
  const numOrdenes = resumen.numOrdenes

  // Cuadre de caja: efectivo que debería haber en el cajón y diferencia con el
  // conteo físico (+ sobrante, − faltante). El fondo y el conteo son opcionales.
  const fondoNum = Number(fondo) || 0
  const contadoNum = contado.trim() === '' ? undefined : Number(contado) || 0
  const efectivoEsperado = fondoNum + efectivo - gastos
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
    const ventas = corte.totalEfectivo + corte.totalTarjeta + corte.totalTransferencia
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

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tinta">Corte de caja</h1>
          <p className="text-sm text-tinta-suave">Turno actual e historial de cortes</p>
        </div>
        <button
          onClick={abrirCierre}
          disabled={numOrdenes === 0}
          className="rounded-lg bg-acento px-4 py-2.5 font-semibold text-white transition enabled:hover:bg-acento-hover disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-tinta-suave/50"
        >
          Cerrar turno
        </button>
      </header>

      {/* Estado de la caja (apertura con fondo) */}
      <div
        className={`mb-6 flex items-center justify-between rounded-xl border px-5 py-3 ${
          caja.abierta ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${caja.abierta ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div className="text-sm">
            {caja.abierta ? (
              <span className="text-tinta">
                Caja <strong>abierta</strong> · fondo <strong>{pesos(caja.fondoInicial)}</strong>
                {caja.abiertoEn ? ` · desde ${hora(caja.abiertoEn)}` : ''}
              </span>
            ) : (
              <span className="text-tinta">Caja cerrada — ábrela con su fondo de cambio al iniciar el turno.</span>
            )}
          </div>
        </div>
        {!caja.abierta && (
          <button
            onClick={() => {
              setFondoApertura('')
              setAbriendo(true)
            }}
            className="rounded-md bg-acento px-3 py-1.5 text-xs font-semibold text-white hover:bg-acento-hover"
          >
            Abrir caja
          </button>
        )}
      </div>

      {/* Turno actual */}
      <section className="mb-8">
        <div className="mb-4 grid grid-cols-3 gap-4">
          <Tarjeta label="Efectivo" monto={efectivo} icono="efectivo" />
          <Tarjeta label="Tarjeta" monto={tarjeta} icono="tarjeta" />
          <Tarjeta label="Transferencia" monto={transferencia} icono="transferencia" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Tarjeta label="Ventas" monto={total} icono="cobro" />
          <Tarjeta label="Gastos" monto={gastos} icono="gasto" negativo />
          <Tarjeta label="Balance del turno" monto={balance} icono="corte" destacar />
        </div>
        <p className="mt-3 text-sm text-tinta-suave">
          {numOrdenes} {numOrdenes === 1 ? 'orden cobrada' : 'órdenes cobradas'} en el turno
        </p>
      </section>

      {/* Ventas del turno (con opción de devolver) */}
      {cobradas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-tinta">Ventas del turno</h2>
          <div className="max-h-64 overflow-auto rounded-xl border border-black/[0.06] bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/[0.03] text-left text-xs uppercase text-tinta-suave">
                <tr>
                  <th className="px-4 py-2.5">Hora</th>
                  <th className="px-4 py-2.5">Orden</th>
                  <th className="px-4 py-2.5">Método</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cobradas.map((o) => (
                  <tr key={o.id} className="border-t border-black/[0.04]">
                    <td className="px-4 py-2 text-tinta-suave">{hora(o.cerradoEn)}</td>
                    <td className="px-4 py-2 text-tinta">
                      {o.paraLlevar ? o.nombre ?? 'Para llevar' : nombreOrden(o.id)}
                    </td>
                    <td className="px-4 py-2 capitalize text-tinta-suave">{o.metodoPago ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-tinta">
                      {pesos(netoOrden(o))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setMotivoDev('')
                          setDevolviendo(o)
                        }}
                        className="rounded-md border border-black/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Devolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                  const ventas = c.totalEfectivo + c.totalTarjeta + c.totalTransferencia
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
                          <span className="font-semibold text-emerald-600">Cuadra</span>
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => void confirmarCierre()}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
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
                    ? 'text-emerald-600'
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
            Esperado = fondo + ventas en efectivo − gastos. Déjalos vacíos para omitir el cuadre.
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={() => void confirmarApertura()}
              className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarDevolucion}
              disabled={!motivoDev.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
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

function Tarjeta({
  label,
  monto,
  icono,
  destacar,
  negativo
}: {
  label: string
  monto: number
  icono: NombreIcono
  destacar?: boolean
  negativo?: boolean
}): React.JSX.Element {
  const colorMonto = destacar
    ? monto < 0
      ? 'text-red-300'
      : 'text-white'
    : negativo
      ? 'text-red-600'
      : 'text-tinta'
  return (
    <div
      className={`rounded-lg border p-5 ${
        destacar ? 'border-acento bg-acento text-white' : 'border-black/[0.06] bg-white'
      }`}
    >
      <div
        className={`mb-2 flex items-center gap-2 text-sm ${
          destacar ? 'text-white/70' : 'text-tinta-suave'
        }`}
      >
        <Icono nombre={icono} size={16} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorMonto}`}>
        {negativo && monto > 0 ? `−${pesos(monto)}` : pesos(monto)}
      </div>
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
