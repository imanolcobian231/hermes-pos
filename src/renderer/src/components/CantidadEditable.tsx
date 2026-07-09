import { useEffect, useState } from 'react'

// Cantidad editable de una línea: se puede teclear el número (ej. 100) en vez de
// picar "+" muchas veces. Al enfocar selecciona todo; confirma con Enter o al
// salir del campo. El valor real lo dicta la orden (se sincroniza al cambiar).
export function CantidadEditable({
  valor,
  onFijar
}: {
  valor: number
  onFijar: (n: number) => void
}): React.JSX.Element {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => setTexto(String(valor)), [valor])

  const confirmar = (): void => {
    const n = parseInt(texto, 10)
    if (Number.isNaN(n) || n < 1) {
      setTexto(String(valor)) // revierte una entrada inválida
      return
    }
    if (n !== valor) onFijar(n)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          confirmar()
          e.currentTarget.blur()
        }
      }}
      aria-label="Cantidad"
      className="w-11 rounded-md border border-black/10 py-1.5 text-center font-semibold text-tinta outline-none focus:border-acento focus:ring-2 focus:ring-acento/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}
