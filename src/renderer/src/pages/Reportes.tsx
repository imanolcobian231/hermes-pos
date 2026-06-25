import { useCallback, useEffect, useState } from 'react'
import type { ReporteVentas } from '@shared/types'
import { pesos } from '@renderer/lib/format'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { useToast } from '@renderer/components/Toast'

// Fecha local en formato YYYY-MM-DD (para los inputs y el rango del reporte).
function isoLocal(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// "2026-06-25" -> "25 jun" (usa mediodía local para evitar saltos de zona).
function etiquetaDia(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

const HOY = new Date()
const INICIO_MES = new Date(HOY.getFullYear(), HOY.getMonth(), 1)

export function Reportes(): React.JSX.Element {
  const toast = useToast()
  const [desde, setDesde] = useState(isoLocal(INICIO_MES))
  const [hasta, setHasta] = useState(isoLocal(HOY))
  const [rep, setRep] = useState<ReporteVentas | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async (): Promise<void> => {
    setCargando(true)
    try {
      setRep(await window.api.reportes.generar(desde, hasta))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo generar el reporte', 'error')
    } finally {
      setCargando(false)
    }
  }, [desde, hasta, toast])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const rango = (dDesde: Date, dHasta: Date): void => {
    setDesde(isoLocal(dDesde))
    setHasta(isoLocal(dHasta))
  }

  const maxDia = Math.max(1, ...(rep?.porDia.map((d) => d.ventas) ?? [0]))
  const totalMetodos = rep ? rep.porMetodo.efectivo + rep.porMetodo.tarjeta + rep.porMetodo.transferencia : 0

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500">Ventas por rango de fechas</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-2">
            <CampoFecha label="Desde" valor={desde} onChange={setDesde} max={hasta} />
            <CampoFecha label="Hasta" valor={hasta} onChange={setHasta} min={desde} />
          </div>
          <div className="flex gap-1.5">
            <BotonRango onClick={() => rango(HOY, HOY)}>Hoy</BotonRango>
            <BotonRango
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 6)
                rango(d, new Date())
              }}
            >
              7 días
            </BotonRango>
            <BotonRango onClick={() => rango(INICIO_MES, new Date())}>Mes</BotonRango>
          </div>
        </div>
      </header>

      {cargando && !rep ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">Cargando…</div>
      ) : !rep || rep.resumen.numOrdenes === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
          <Icono nombre="finanzas" size={40} className="text-slate-300" />
          <p className="mt-3 font-semibold">Sin ventas en este rango</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 overflow-auto pb-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tarjeta label="Ventas" valor={pesos(rep.resumen.ventas)} icono="cobro" destacar />
            <Tarjeta label="Órdenes" valor={String(rep.resumen.numOrdenes)} icono="recibo" />
            <Tarjeta label="Ticket promedio" valor={pesos(rep.resumen.ticketPromedio)} icono="finanzas" />
            <Tarjeta label="Descuentos" valor={pesos(rep.resumen.descuentos)} icono="gasto" />
          </div>

          {/* Ventas por día */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
              Ventas por día
            </h2>
            <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 160 }}>
              {rep.porDia.map((d) => (
                <div key={d.fecha} className="flex w-12 shrink-0 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {pesos(d.ventas).replace('.00', '')}
                  </span>
                  <div
                    className="w-7 rounded-t bg-slate-800"
                    style={{ height: Math.round((d.ventas / maxDia) * 110) + 2 }}
                    title={`${etiquetaDia(d.fecha)}: ${pesos(d.ventas)} · ${d.numOrdenes} órd.`}
                  />
                  <span className="text-[10px] text-slate-400">{etiquetaDia(d.fecha)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top productos */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                Productos más vendidos
              </h2>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-2">Producto</th>
                    <th className="pb-2 text-right">Cant.</th>
                    <th className="pb-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {rep.topProductos.map((p) => (
                    <tr key={p.nombre} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-700">{p.nombre}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-700">{p.cantidad}</td>
                      <td className="py-1.5 text-right text-slate-600">{pesos(p.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Por método de pago */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
                Por método de pago
              </h2>
              <div className="flex flex-col gap-3">
                <BarraMetodo label="Efectivo" icono="efectivo" monto={rep.porMetodo.efectivo} total={totalMetodos} />
                <BarraMetodo label="Tarjeta" icono="tarjeta" monto={rep.porMetodo.tarjeta} total={totalMetodos} />
                <BarraMetodo
                  label="Transferencia"
                  icono="transferencia"
                  monto={rep.porMetodo.transferencia}
                  total={totalMetodos}
                />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function CampoFecha({
  label,
  valor,
  onChange,
  min,
  max
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  min?: string
  max?: string
}): React.JSX.Element {
  return (
    <label className="flex flex-col text-xs font-medium text-slate-500">
      {label}
      <input
        type="date"
        value={valor}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-500"
      />
    </label>
  )
}

function BotonRango({
  onClick,
  children
}: {
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  )
}

function Tarjeta({
  label,
  valor,
  icono,
  destacar
}: {
  label: string
  valor: string
  icono: NombreIcono
  destacar?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`rounded-lg border p-4 ${
        destacar ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
      }`}
    >
      <div
        className={`mb-1.5 flex items-center gap-2 text-xs ${destacar ? 'text-slate-300' : 'text-slate-500'}`}
      >
        <Icono nombre={icono} size={15} />
        {label}
      </div>
      <div className={`text-xl font-bold ${destacar ? 'text-white' : 'text-slate-900'}`}>{valor}</div>
    </div>
  )
}

function BarraMetodo({
  label,
  icono,
  monto,
  total
}: {
  label: string
  icono: NombreIcono
  monto: number
  total: number
}): React.JSX.Element {
  const pct = total > 0 ? Math.round((monto / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-600">
          <Icono nombre={icono} size={15} />
          {label}
        </span>
        <span className="font-semibold text-slate-700">
          {pesos(monto)} <span className="text-xs text-slate-400">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
