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
          <button onClick={onCancelar} className="btn-texto">
            {textoCancelar}
          </button>
          <button onClick={onConfirmar} className={peligro ? 'btn-peligro' : 'btn-primario'}>
            {textoConfirmar}
          </button>
        </>
      }
    >
      <div className="text-sm text-tinta-suave">{mensaje}</div>
    </Modal>
  )
}
