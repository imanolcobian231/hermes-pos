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
            className="mr-auto rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
            title="Quita el filtro y muestra todos los dispositivos Bluetooth"
          >
            Mostrar todos
          </button>
          <button
            onClick={cancelarSelector}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-tinta-suave hover:bg-black/[0.05]"
          >
            Cancelar
          </button>
        </>
      }
    >
      {selector.dispositivos.length === 0 ? (
        <div className="flex items-center justify-center gap-3 py-6 text-tinta-suave">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-tinta" />
          Buscando dispositivos…
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {selector.dispositivos.map((d) => (
            <button
              key={d.id}
              onClick={() => elegirDispositivo(d.id)}
              className="flex items-center justify-between rounded-lg border border-black/[0.06] px-4 py-3 text-left hover:border-black/20 hover:bg-black/[0.03]"
            >
              <span className="font-semibold text-tinta">{d.nombre}</span>
              <span className="text-xs text-tinta-suave">Conectar</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
