import { useMemo, useState } from 'react'

// Selector de rango de fechas con calendario (popover). Sin dependencias: se
// arma con Date nativo. Al primer clic fija el inicio; al segundo, el fin (y
// cierra). Muestra el rango resaltado con extremos redondeados.

function iso(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// Mediodía local para no cruzar zona horaria al parsear.
function parse(s: string): Date {
  return new Date(s + 'T12:00:00')
}
function inicioMes(s: string): Date {
  const d = parse(s)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]
const abr = (m: number): string => MESES[m].slice(0, 3)

export function RangoFechas({
  desde,
  hasta,
  onChange
}: {
  desde: string
  hasta: string
  onChange: (desde: string, hasta: string) => void
}): React.JSX.Element {
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(() => inicioMes(hasta))
  const [ancla, setAncla] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const hoy = iso(new Date())

  // Rango a resaltar: en curso (ancla + hover) o el ya confirmado.
  const [selLo, selHi] = useMemo(() => {
    if (ancla) {
      const h = hover ?? ancla
      return ancla <= h ? [ancla, h] : [h, ancla]
    }
    return [desde, hasta]
  }, [ancla, hover, desde, hasta])

  const clickDia = (d: string): void => {
    if (d > hoy) return
    if (!ancla) {
      setAncla(d)
      setHover(d)
    } else {
      const lo = d <= ancla ? d : ancla
      const hi = d <= ancla ? ancla : d
      onChange(lo, hi)
      setAncla(null)
      setHover(null)
      setAbierto(false)
    }
  }

  const cerrar = (): void => {
    setAbierto(false)
    setAncla(null)
    setHover(null)
  }
  const toggle = (): void => {
    if (!abierto) setMes(inicioMes(hasta))
    setAbierto((v) => !v)
  }

  const y = mes.getFullYear()
  const m = mes.getMonth()
  const primerDia = new Date(y, m, 1).getDay()
  const numDias = new Date(y, m + 1, 0).getDate()
  const celdas: (string | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: numDias }, (_, i) => iso(new Date(y, m, i + 1)))
  ]
  const hoyMes = new Date()
  const sigDeshab = y > hoyMes.getFullYear() || (y === hoyMes.getFullYear() && m >= hoyMes.getMonth())

  const etiqueta = (): string => {
    const a = parse(desde)
    const b = parse(hasta)
    const anio = a.getFullYear() === b.getFullYear() ? ` ${b.getFullYear()}` : ''
    if (desde === hasta) return `${a.getDate()} ${abr(a.getMonth())}${anio}`
    return `${a.getDate()} ${abr(a.getMonth())} – ${b.getDate()} ${abr(b.getMonth())}${anio}`
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2 text-sm font-semibold text-tinta shadow-sm transition hover:border-black/20"
      >
        <IconoCal />
        {etiqueta()}
        <svg width="12" height="12" viewBox="0 0 24 24" className="text-tinta-suave" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={cerrar} />
          <div className="animar-modal absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-black/[0.08] bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setMes(new Date(y, m - 1, 1))}
                className="rounded-lg p-1.5 text-tinta-suave transition hover:bg-black/[0.05] hover:text-tinta"
                aria-label="Mes anterior"
              >
                <Flecha dir="izq" />
              </button>
              <span className="text-sm font-bold capitalize text-tinta">
                {MESES[m]} {y}
              </span>
              <button
                onClick={() => !sigDeshab && setMes(new Date(y, m + 1, 1))}
                disabled={sigDeshab}
                className="rounded-lg p-1.5 text-tinta-suave transition enabled:hover:bg-black/[0.05] enabled:hover:text-tinta disabled:opacity-30"
                aria-label="Mes siguiente"
              >
                <Flecha dir="der" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-tinta-suave">
              {DIAS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {celdas.map((c, i) => {
                if (!c) return <span key={i} />
                const futuro = c > hoy
                const enRango = c >= selLo && c <= selHi
                const esLo = c === selLo && enRango
                const esHi = c === selHi && enRango
                const extremo = esLo || esHi
                const esHoy = c === hoy
                return (
                  <button
                    key={i}
                    disabled={futuro}
                    onMouseEnter={() => ancla && setHover(c)}
                    onClick={() => clickDia(c)}
                    className={`flex h-8 items-center justify-center text-sm transition ${
                      enRango && !extremo ? 'bg-acento/10' : ''
                    } ${esLo ? 'rounded-l-full' : ''} ${esHi ? 'rounded-r-full' : ''} ${
                      enRango && !extremo ? '' : 'rounded-full'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        extremo
                          ? 'bg-acento font-semibold text-white'
                          : futuro
                            ? 'text-tinta-suave/30'
                            : esHoy
                              ? 'font-semibold text-acento ring-1 ring-inset ring-acento/40'
                              : 'text-tinta hover:bg-black/[0.05]'
                      }`}
                    >
                      {parse(c).getDate()}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="mt-2 px-1 text-center text-[11px] text-tinta-suave">
              {ancla ? 'Elige la fecha final' : 'Toca la fecha inicial'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function IconoCal(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="text-tinta-suave" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v3M16 3v3" strokeLinecap="round" />
    </svg>
  )
}

function Flecha({ dir }: { dir: 'izq' | 'der' }): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d={dir === 'izq' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
