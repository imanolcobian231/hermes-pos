import { Modal } from '@renderer/components/Modal'

interface Props {
  abierto: boolean
  titulo: string
  mensaje: React.ReactNode
  textoConfirmar?: string
  textoCancelar?: string
  /** Estilo destructivo (rojo) para acciones irreversibles. */
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligro,
  onConfirmar,
  onCancelar
}: Props): React.JSX.Element {
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      pie={
        <>
          <button
            onClick={onCancelar}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {textoConfirmar}
          </button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{mensaje}</div>
    </Modal>
  )
}
