import { useState } from 'react'
import { useDatos } from '@renderer/store/datos'
import { fechaHora, hora, pesos } from '@renderer/lib/format'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toast'
import { Icono, type NombreIcono } from '@renderer/components/Icono'

export function Corte(): React.JSX.Element {
  const { cortes, reimpresiones, resumen, cerrarCorte } = useDatos()
  const toast = useToast()
  const [confirmar, setConfirmar] = useState(false)

  const nombreOrden = (ordenId: number): string => `Orden #${ordenId}`

  const efectivo = resumen.totalEfectivo
  const tarjeta = resumen.totalTarjeta
  const transferencia = resumen.totalTransferencia
  const total = efectivo + tarjeta + transferencia
  const numOrdenes = resumen.numOrdenes

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Corte de caja</h1>
          <p className="text-sm text-slate-500">Turno actual e historial de cortes</p>
        </div>
        <button
          onClick={() => setConfirmar(true)}
          disabled={numOrdenes === 0}
          className="rounded-lg bg-slate-800 px-4 py-2.5 font-semibold text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Cerrar turno
        </button>
      </header>

      {/* Turno actual */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Tarjeta label="Efectivo" monto={efectivo} icono="efectivo" />
          <Tarjeta label="Tarjeta" monto={tarjeta} icono="tarjeta" />
          <Tarjeta label="Transferencia" monto={transferencia} icono="transferencia" />
          <Tarjeta label="Total turno" monto={total} icono="corte" destacar />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {numOrdenes} {numOrdenes === 1 ? 'orden cobrada' : 'órdenes cobradas'} en el turno
        </p>
      </section>

      {/* Historial */}
      <section className="flex-1 overflow-auto">
        <h2 className="mb-3 text-lg font-bold text-slate-700">Historial de cortes</h2>
        {cortes.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no se ha cerrado ningún turno.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5 text-right">Efectivo</th>
                  <th className="px-4 py-2.5 text-right">Tarjeta</th>
                  <th className="px-4 py-2.5 text-right">Transfer.</th>
                  <th className="px-4 py-2.5 text-right">Órdenes</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {cortes.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">{fechaHora(c.cerradoEn)}</td>
                    <td className="px-4 py-2.5 text-right">{pesos(c.totalEfectivo)}</td>
                    <td className="px-4 py-2.5 text-right">{pesos(c.totalTarjeta)}</td>
                    <td className="px-4 py-2.5 text-right">{pesos(c.totalTransferencia)}</td>
                    <td className="px-4 py-2.5 text-right">{c.numOrdenes}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                      {pesos(c.totalEfectivo + c.totalTarjeta + c.totalTransferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Auditoría de reimpresiones del turno */}
      {reimpresiones.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-slate-700">Reimpresiones del turno</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Hora</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Mesa / Orden</th>
                  <th className="px-4 py-2.5">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {reimpresiones.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-600">{hora(r.reimprimirEn)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          r.tipo === 'cocina'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        {r.tipo === 'cocina' ? 'Cocina' : 'Ticket final'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{nombreOrden(r.ordenId)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.usuario}</td>
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                const corte = await cerrarCorte()
                setConfirmar(false)
                toast(
                  `Turno cerrado · ${pesos(
                    corte.totalEfectivo + corte.totalTarjeta + corte.totalTransferencia
                  )}`
                )
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Cerrar turno
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Se registrará un corte por <strong>{pesos(total)}</strong> ({numOrdenes} órdenes) y se
          iniciará un turno nuevo. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}

function Tarjeta({
  label,
  monto,
  icono,
  destacar
}: {
  label: string
  monto: number
  icono: NombreIcono
  destacar?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`rounded-lg border p-5 ${
        destacar ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
      }`}
    >
      <div
        className={`mb-2 flex items-center gap-2 text-sm ${
          destacar ? 'text-slate-300' : 'text-slate-500'
        }`}
      >
        <Icono nombre={icono} size={16} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${destacar ? 'text-white' : 'text-slate-900'}`}>
        {pesos(monto)}
      </div>
    </div>
  )
}
