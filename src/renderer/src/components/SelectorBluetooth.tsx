import { Modal } from '@renderer/components/Modal'
import { useImpresion } from '@renderer/store/impresion'

// Selector de dispositivos Bluetooth. Se muestra automáticamente cuando el main
// reenvía la lista de dispositivos detectados durante una conexión.
export function SelectorBluetooth(): React.JSX.Element | null {
  const { selector, elegirDispositivo, cancelarSelector, mostrarTodos } = useImpresion()
  if (!selector.visible) return null

  return (
    <Modal
      abierto={selector.visible}
      titulo="Selecciona la impresora"
      onCerrar={cancelarSelector}
      pie={
        <>
          <button
            onClick={mostrarTodos}
            className="mr-auto rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            title="Quita el filtro y muestra todos los dispositivos Bluetooth"
          >
            Mostrar todos
          </button>
          <button
            onClick={cancelarSelector}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </>
      }
    >
      {selector.dispositivos.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-6 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Buscando dispositivos…
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {selector.dispositivos.map((d) => (
            <button
              key={d.id}
              onClick={() => elegirDispositivo(d.id)}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-slate-400 hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-800">{d.nombre}</span>
              <span className="text-xs text-slate-400">Conectar</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
