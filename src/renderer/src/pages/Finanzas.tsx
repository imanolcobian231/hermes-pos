import { useMemo, useState } from 'react'
import type { OrdenConDetalle } from '@shared/types'
import { useDatos } from '@renderer/store/datos'
import { hora, pesos } from '@renderer/lib/format'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'

const etiquetaMetodo: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
}

export function Finanzas(): React.JSX.Element {
  const { mesas, gastos, cobradas, resumen, agregarGasto, eliminarGasto } = useDatos()
  const toast = useToast()

  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')

  const ingresos = resumen.totalEfectivo + resumen.totalTarjeta + resumen.totalTransferencia
  const balance = ingresos - resumen.totalGastos

  const etiquetaOrden = useMemo(() => {
    return (o: OrdenConDetalle): string =>
      o.paraLlevar ? o.nombre ?? 'Para llevar' : mesas.find((m) => m.id === o.mesaId)?.nombre ?? 'Mesa'
  }, [mesas])

  const guardarGasto = async (): Promise<void> => {
    const c = concepto.trim()
    const m = Number(monto)
    if (!c || !m || m <= 0) return
    await agregarGasto(c, m)
    setConcepto('')
    setMonto('')
    toast('Gasto registrado')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-tinta">Finanzas</h1>
        <p className="text-sm text-tinta-suave">Ingresos, gastos y balance del turno actual</p>
      </header>

      {/* Resumen */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaResumen label="Ingresos" monto={ingresos} icono="cobro" />
        <TarjetaResumen label="Gastos" monto={resumen.totalGastos} icono="gasto" negativo />
        <TarjetaResumen label="Balance" monto={balance} icono="finanzas" destacar />
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Gastos */}
        <section className="flex w-96 flex-col rounded-xl border border-black/[0.06] bg-white">
          <header className="border-b border-black/[0.04] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-tinta">Gastos del turno</h2>
          </header>

          <div className="border-b border-black/[0.04] p-4">
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Concepto (ej. Hielo, gas, propina)"
              className="mb-2 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave">
                  $
                </span>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarGasto()}
                  placeholder="0.00"
                  className="w-full rounded-md border border-black/10 py-2 pl-7 pr-3 text-right text-sm font-semibold outline-none focus:border-acento focus:ring-2 focus:ring-acento/15"
                />
              </div>
              <button
                onClick={guardarGasto}
                className="rounded-md bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-acento-hover"
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-2 py-2">
            {gastos.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-tinta-suave">Sin gastos en el turno</p>
            ) : (
              gastos.map((g) => (
                <div
                  key={g.id}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/[0.03]"
                >
                  <div>
                    <div className="text-sm font-medium text-tinta">{g.concepto}</div>
                    <div className="text-xs text-tinta-suave">{hora(g.fecha)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">−{pesos(g.monto)}</span>
                    <button
                      onClick={() => {
                        void eliminarGasto(g.id)
                        toast('Gasto eliminado', 'info')
                      }}
                      className="rounded p-1 text-tinta-suave/60 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      aria-label="Eliminar gasto"
                    >
                      <Icono nombre="eliminar" size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {gastos.length > 0 && (
            <footer className="flex justify-between border-t border-black/[0.04] px-5 py-3 text-sm">
              <span className="font-semibold text-tinta-suave">Total gastos</span>
              <span className="font-bold text-red-600">−{pesos(resumen.totalGastos)}</span>
            </footer>
          )}
        </section>

        {/* Órdenes cobradas */}
        <section className="flex flex-1 flex-col rounded-xl border border-black/[0.06] bg-white">
          <header className="flex items-center justify-between border-b border-black/[0.04] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-tinta">Órdenes cobradas</h2>
            <span className="text-xs text-tinta-suave">{cobradas.length} en el turno</span>
          </header>

          {cobradas.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
              <Icono nombre="recibo" size={36} className="text-tinta-suave/60" />
              <p className="mt-2 text-sm font-medium">Aún no hay ventas cobradas</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/[0.03] text-left text-xs uppercase tracking-wide text-tinta-suave">
                  <tr>
                    <th className="px-5 py-2.5">Cuenta</th>
                    <th className="px-5 py-2.5">Hora</th>
                    <th className="px-5 py-2.5">Método</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cobradas.map((o) => (
                    <tr key={o.id} className="border-t border-black/[0.04]">
                      <td className="px-5 py-2.5 font-medium text-tinta">{etiquetaOrden(o)}</td>
                      <td className="px-5 py-2.5 text-tinta-suave">{hora(o.cerradoEn)}</td>
                      <td className="px-5 py-2.5 text-tinta-suave">
                        {o.metodoPago ? etiquetaMetodo[o.metodoPago] : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-tinta">
                        {pesos(o.total - o.descuento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function TarjetaResumen({
  label,
  monto,
  icono,
  negativo,
  destacar
}: {
  label: string
  monto: number
  icono: 'cobro' | 'gasto' | 'finanzas'
  negativo?: boolean
  destacar?: boolean
}): React.JSX.Element {
  const color = destacar
    ? monto < 0
      ? 'text-red-300'
      : 'text-white'
    : negativo
      ? 'text-red-600'
      : 'text-tinta'
  return (
    <div
      className={`rounded-xl border p-5 ${
        destacar ? 'border-acento bg-acento' : 'border-black/[0.06] bg-white'
      }`}
    >
      <div
        className={`mb-2 flex items-center gap-2 text-sm ${destacar ? 'text-white/70' : 'text-tinta-suave'}`}
      >
        <Icono nombre={icono} size={16} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {negativo && monto > 0 ? `−${pesos(monto)}` : pesos(monto)}
      </div>
    </div>
  )
}
