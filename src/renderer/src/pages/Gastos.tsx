import { useState } from 'react'
import { useDatos } from '@renderer/store/datos'
import { hora, pesos } from '@renderer/lib/format'
import { useToast } from '@renderer/components/Toast'
import { Icono } from '@renderer/components/Icono'

// Página de gastos pensada para el rol mesero: solo registrar gastos del turno,
// sin totales, balances ni cifras de ventas.
export function Gastos(): React.JSX.Element {
  const { gastos, agregarGasto } = useDatos()
  const toast = useToast()
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')

  const guardar = async (): Promise<void> => {
    const c = concepto.trim()
    const m = Number(monto)
    if (!c || !m || m <= 0) return
    await agregarGasto(c, m)
    setConcepto('')
    setMonto('')
    toast('Gasto registrado')
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Gastos</h1>
        <p className="text-sm text-slate-500">Registra los gastos del turno</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Concepto (ej. Hielo, gas, mandado)"
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              placeholder="0.00"
              className="w-full rounded-md border border-slate-300 py-2 pl-7 pr-3 text-right text-sm font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            onClick={guardar}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Agregar
          </button>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Gastos del turno
      </h2>
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        {gastos.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">Sin gastos en el turno</p>
        ) : (
          gastos.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">{g.concepto}</div>
                <div className="text-xs text-slate-400">{hora(g.fecha)}</div>
              </div>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <Icono nombre="gasto" size={14} />
                {pesos(g.monto)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
