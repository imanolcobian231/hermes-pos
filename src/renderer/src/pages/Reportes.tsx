import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReporteVentas } from '@shared/types'
import { pesos } from '@renderer/lib/format'
import { Icono, type NombreIcono } from '@renderer/components/Icono'
import { RangoFechas } from '@renderer/components/RangoFechas'
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

// Monto compacto para etiquetas apretadas (ej. $12,340 -> $12.3k).
function compacto(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `$${Math.round(n)}`
}

const HOY = new Date()
const INICIO_MES = new Date(HOY.getFullYear(), HOY.getMonth(), 1)

// Colores de cada método de pago (donut + leyenda).
const COLOR_METODO = { efectivo: '#0f4c5c', tarjeta: '#3b82f6', transferencia: '#f59e0b' } as const

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

  const aplicarRango = (dDesde: Date, dHasta: Date): void => {
    setDesde(isoLocal(dDesde))
    setHasta(isoLocal(dHasta))
  }

  // Presets de rango (con detección del activo para resaltarlo).
  const hace = (dias: number): Date => {
    const d = new Date()
    d.setDate(d.getDate() - dias)
    return d
  }
  const presets = [
    { id: 'hoy', label: 'Hoy', desde: isoLocal(HOY), hasta: isoLocal(HOY), set: () => aplicarRango(HOY, new Date()) },
    { id: '7', label: '7 días', desde: isoLocal(hace(6)), hasta: isoLocal(HOY), set: () => aplicarRango(hace(6), new Date()) },
    { id: '30', label: '30 días', desde: isoLocal(hace(29)), hasta: isoLocal(HOY), set: () => aplicarRango(hace(29), new Date()) },
    { id: 'mes', label: 'Mes', desde: isoLocal(INICIO_MES), hasta: isoLocal(HOY), set: () => aplicarRango(INICIO_MES, new Date()) }
  ]

  const maxDia = Math.max(1, ...(rep?.porDia.map((d) => d.ventas) ?? [0]))
  const totalMetodos = rep
    ? rep.porMetodo.efectivo + rep.porMetodo.tarjeta + rep.porMetodo.transferencia
    : 0
  const margen = rep && rep.resumen.ventas > 0 ? (rep.resumen.utilidad / rep.resumen.ventas) * 100 : 0
  const maxCantProd = Math.max(1, ...(rep?.topProductos.map((p) => p.cantidad) ?? [0]))
  const diasConVenta = useMemo(() => rep?.porDia.filter((d) => d.numOrdenes > 0).length ?? 0, [rep])

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado con rango de fechas */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">Reportes</h1>
          <p className="text-sm text-tinta-suave">Análisis de ventas por rango de fechas</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <RangoFechas
            desde={desde}
            hasta={hasta}
            onChange={(d, h) => {
              setDesde(d)
              setHasta(h)
            }}
          />
          <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1">
            {presets.map((p) => {
              const activo = desde === p.desde && hasta === p.hasta
              return (
                <button
                  key={p.id}
                  onClick={p.set}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activo ? 'bg-white text-acento shadow-sm' : 'text-tinta-suave hover:text-tinta'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {cargando && !rep ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-tinta-suave">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-tinta" />
          Cargando…
        </div>
      ) : !rep || rep.resumen.numOrdenes === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-tinta-suave">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04]">
            <Icono nombre="finanzas" size={32} className="text-tinta-suave/50" />
          </div>
          <p className="mt-4 font-semibold text-tinta">Sin ventas en este rango</p>
          <p className="text-sm">Elige otras fechas o registra ventas para ver el reporte.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 overflow-auto pb-6">
          {/* Hero: Ventas + Utilidad */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-acento to-acento-hover p-6 text-white shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
                <Icono nombre="cobro" size={16} /> Ventas del periodo
              </div>
              <div className="text-4xl font-bold tabular-nums tracking-tight">{pesos(rep.resumen.ventas)}</div>
              <div className="mt-2 text-sm text-white/75">
                {rep.resumen.numOrdenes} órdenes · ticket prom. {pesos(rep.resumen.ticketPromedio)}
              </div>
              <Icono
                nombre="cobro"
                size={120}
                className="pointer-events-none absolute -bottom-6 -right-4 text-white/10"
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-tinta-suave">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-acento/10 text-acento">
                  <Icono nombre="finanzas" size={14} />
                </span>
                Utilidad estimada
              </div>
              <div className="text-4xl font-bold tabular-nums tracking-tight text-tinta">
                {pesos(rep.resumen.utilidad)}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    margen >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {margen.toFixed(0)}% margen
                </span>
                <span className="text-tinta-suave">costo {pesos(rep.resumen.costoVendido)}</span>
              </div>
            </div>
          </div>

          {/* KPIs secundarios */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Órdenes" valor={String(rep.resumen.numOrdenes)} icono="recibo" />
            <Kpi label="Ticket promedio" valor={pesos(rep.resumen.ticketPromedio)} icono="cobro" />
            <Kpi label="Propinas" valor={pesos(rep.resumen.propinas)} icono="finanzas" tono="verde" />
            <Kpi label="Descuentos" valor={pesos(rep.resumen.descuentos)} icono="gasto" tono="ambar" />
            <Kpi label="Costo vendido" valor={pesos(rep.resumen.costoVendido)} icono="gasto" />
          </div>

          {/* Ventas por día + Métodos de pago */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel titulo="Ventas por día" className="lg:col-span-2">
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1 pt-6" style={{ minHeight: 190 }}>
                {rep.porDia.map((d) => {
                  const h = Math.round((d.ventas / maxDia) * 130) + 3
                  const pico = d.ventas === maxDia && d.ventas > 0
                  return (
                    <div
                      key={d.fecha}
                      className="group flex min-w-[38px] flex-1 flex-col items-center gap-1.5"
                      title={`${etiquetaDia(d.fecha)}: ${pesos(d.ventas)} · ${d.numOrdenes} órd.`}
                    >
                      <span
                        className={`text-[10px] font-bold tabular-nums ${
                          pico ? 'text-acento' : 'text-tinta-suave'
                        }`}
                      >
                        {d.ventas > 0 ? compacto(d.ventas) : ''}
                      </span>
                      <div className="flex w-full items-end justify-center" style={{ height: 135 }}>
                        <div
                          className={`w-7 rounded-t-md transition-all group-hover:opacity-80 ${
                            pico
                              ? 'bg-gradient-to-t from-acento to-acento-hover'
                              : 'bg-gradient-to-t from-acento/70 to-acento/40'
                          }`}
                          style={{ height: h }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-tinta-suave">
                        {etiquetaDia(d.fecha)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Panel>

            <Panel titulo="Métodos de pago">
              <div className="flex flex-col items-center gap-4">
                <Donut
                  segmentos={[
                    { label: 'Efectivo', valor: rep.porMetodo.efectivo, color: COLOR_METODO.efectivo },
                    { label: 'Tarjeta', valor: rep.porMetodo.tarjeta, color: COLOR_METODO.tarjeta },
                    {
                      label: 'Transferencia',
                      valor: rep.porMetodo.transferencia,
                      color: COLOR_METODO.transferencia
                    }
                  ]}
                  total={totalMetodos}
                />
                <div className="w-full space-y-2">
                  <LeyendaMetodo label="Efectivo" icono="efectivo" monto={rep.porMetodo.efectivo} total={totalMetodos} color={COLOR_METODO.efectivo} />
                  <LeyendaMetodo label="Tarjeta" icono="tarjeta" monto={rep.porMetodo.tarjeta} total={totalMetodos} color={COLOR_METODO.tarjeta} />
                  <LeyendaMetodo label="Transferencia" icono="transferencia" monto={rep.porMetodo.transferencia} total={totalMetodos} color={COLOR_METODO.transferencia} />
                </div>
              </div>
            </Panel>
          </div>

          {/* Productos más vendidos */}
          <Panel titulo="Productos más vendidos">
            {rep.topProductos.length === 0 ? (
              <p className="py-6 text-center text-sm text-tinta-suave">Sin productos en el rango.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {rep.topProductos.map((p, i) => (
                  <div
                    key={p.nombre}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-black/[0.02]"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        i === 0
                          ? 'bg-amber-100 text-amber-700'
                          : i === 1
                            ? 'bg-black/[0.06] text-tinta-suave'
                            : i === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-black/[0.03] text-tinta-suave'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-tinta">{p.nombre}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-tinta">
                          {pesos(p.importe)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-black/[0.05]">
                          <div
                            className="h-1.5 rounded-full bg-acento/70"
                            style={{ width: `${Math.round((p.cantidad / maxCantProd) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs text-tinta-suave">
                          {p.cantidad} vendidos
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <p className="text-center text-xs text-tinta-suave/80">
            {diasConVenta} {diasConVenta === 1 ? 'día' : 'días'} con ventas en el rango · la utilidad usa
            el costo actual de cada producto (captúralo en Catálogo para que sea exacta).
          </p>
        </div>
      )}
    </div>
  )
}

// --- Donut SVG de métodos de pago -------------------------------------------
function Donut({
  segmentos,
  total
}: {
  segmentos: { label: string; valor: number; color: string }[]
  total: number
}): React.JSX.Element {
  const r = 40
  const circ = 2 * Math.PI * r
  let acumulado = 0
  const activos = segmentos.filter((s) => s.valor > 0)
  return (
    <div className="relative h-40 w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="13" />
        {total > 0 &&
          activos.map((s) => {
            const frac = s.valor / total
            const dash = frac * circ
            // Pequeño hueco entre segmentos para que se distingan.
            const gap = activos.length > 1 ? 1.5 : 0
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="13"
                strokeDasharray={`${Math.max(0, dash - gap)} ${circ - Math.max(0, dash - gap)}`}
                strokeDashoffset={-acumulado}
              />
            )
            acumulado += dash
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-tinta-suave">Total</span>
        <span className="text-sm font-bold tabular-nums text-tinta">{compacto(total)}</span>
      </div>
    </div>
  )
}

function LeyendaMetodo({
  label,
  icono,
  monto,
  total,
  color
}: {
  label: string
  icono: NombreIcono
  monto: number
  total: number
  color: string
}): React.JSX.Element {
  const pct = total > 0 ? Math.round((monto / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex items-center gap-1 text-tinta-suave">
        <Icono nombre={icono} size={13} />
        {label}
      </span>
      <span className="ml-auto font-semibold tabular-nums text-tinta">{pesos(monto)}</span>
      <span className="w-9 shrink-0 text-right text-xs text-tinta-suave">{pct}%</span>
    </div>
  )
}

// --- Bloques reutilizables --------------------------------------------------
function Panel({
  titulo,
  children,
  className = ''
}: {
  titulo: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-1 text-sm font-bold text-tinta">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Kpi({
  label,
  valor,
  icono,
  tono
}: {
  label: string
  valor: string
  icono: NombreIcono
  tono?: 'ambar' | 'verde'
}): React.JSX.Element {
  const chip =
    tono === 'ambar'
      ? 'bg-amber-50 text-amber-600'
      : tono === 'verde'
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-acento/10 text-acento'
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-tinta-suave">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${chip}`}>
          <Icono nombre={icono} size={13} />
        </span>
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums tracking-tight text-tinta">{valor}</div>
    </div>
  )
}

