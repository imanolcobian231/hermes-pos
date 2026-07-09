import { useEffect, useRef, useState } from 'react'
import { useImpresion } from '@renderer/store/impresion'

// Teclado en pantalla para equipos táctiles sin teclado físico. Se muestra solo
// al enfocar un campo de texto y escribe en él simulando eventos nativos, de modo
// que funciona con los inputs controlados de React (dispara su onChange).
// Se puede desactivar desde Ajustes (config.tecladoVirtual) para equipos con
// teclado físico.

type Editable = HTMLInputElement | HTMLTextAreaElement

const TIPOS_TEXTO = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'number',
  ''
])

function esEditable(el: EventTarget | null): el is Editable {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) {
    return TIPOS_TEXTO.has(el.type) && !el.readOnly && !el.disabled
  }
  return false
}

// Escribe un valor en un input/textarea controlado por React (usa el setter
// nativo + evento 'input' para que React detecte el cambio).
function fijarValor(el: Editable, valor: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, valor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Inserta/borra respetando el cursor cuando el campo lo permite.
function editar(el: Editable, transform: (v: string, ini: number, fin: number) => [string, number]): void {
  let ini = el.value.length
  let fin = el.value.length
  try {
    if (el.selectionStart != null) ini = el.selectionStart
    if (el.selectionEnd != null) fin = el.selectionEnd
  } catch {
    /* type=number no soporta selección: se opera al final */
  }
  const [nuevo, cursor] = transform(el.value, ini, fin)
  fijarValor(el, nuevo)
  try {
    el.setSelectionRange(cursor, cursor)
  } catch {
    /* ignora si no soporta selección */
  }
}

const FILAS_MIN = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.']
]

export function TecladoVirtual(): React.JSX.Element | null {
  const { cfg } = useImpresion()
  // Habilitado salvo que se apague explícitamente en Ajustes (por defecto: sí).
  const habilitado = cfg?.tecladoVirtual !== false
  const [activo, setActivo] = useState<Editable | null>(null)
  const [mayus, setMayus] = useState(false)
  const refActivo = useRef<Editable | null>(null)
  refActivo.current = activo
  // Campo en el que el usuario cerró el teclado a mano: no se reabre solo
  // mientras siga enfocado (así puede seguir escribiendo con el teclado físico).
  const cerradoManualRef = useRef<Editable | null>(null)

  useEffect(() => {
    // Si está desactivado, no se enganchan los listeners y se oculta si estaba.
    if (!habilitado) {
      setActivo(null)
      return
    }
    const onFocusIn = (e: FocusEvent): void => {
      if (!esEditable(e.target)) return
      // Si cerró el teclado a mano en este mismo campo, no reabrir.
      if (e.target === cerradoManualRef.current) return
      cerradoManualRef.current = null
      setActivo(e.target as Editable)
    }
    const onFocusOut = (e: FocusEvent): void => {
      // Si el foco pasa a otro campo editable se actualiza; si va a un botón del
      // teclado no pasa nada (evitan robar foco); si va a otro lado, se oculta.
      const siguiente = e.relatedTarget
      if (siguiente instanceof HTMLElement && siguiente.closest('[data-teclado]')) return
      // Al abandonar el campo se olvida el "cerrado manual": al volver reabre.
      cerradoManualRef.current = null
      setTimeout(() => {
        if (!esEditable(document.activeElement)) setActivo(null)
      }, 0)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [habilitado])

  // Centra el campo enfocado para que el teclado (abajo) no lo tape.
  useEffect(() => {
    if (!activo) return
    try {
      activo.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch {
      /* ignora */
    }
  }, [activo])

  if (!habilitado || !activo) return null

  const insertar = (txt: string): void => {
    const el = refActivo.current
    if (!el) return
    editar(el, (v, i, f) => [v.slice(0, i) + txt + v.slice(f), i + txt.length])
  }

  const borrar = (): void => {
    const el = refActivo.current
    if (!el) return
    editar(el, (v, i, f) => {
      if (i !== f) return [v.slice(0, i) + v.slice(f), i]
      if (i === 0) return [v, 0]
      return [v.slice(0, i - 1) + v.slice(i), i - 1]
    })
  }

  // "Cerrar": oculta el teclado pero deja el campo enfocado, para poder seguir
  // escribiendo con el teclado físico. No se reabre solo en ese mismo campo.
  const cerrar = (): void => {
    cerradoManualRef.current = refActivo.current
    setActivo(null)
  }

  // "Listo": termina la edición (quita el foco del campo) y oculta el teclado.
  const listo = (): void => {
    cerradoManualRef.current = null
    refActivo.current?.blur()
    setActivo(null)
  }

  const Tecla = ({
    children,
    onTap,
    ancho = ''
  }: {
    children: React.ReactNode
    onTap: () => void
    ancho?: string
  }): React.JSX.Element => (
    <button
      // preventDefault en pointerdown evita que el campo pierda el foco.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onTap}
      className={`flex h-14 items-center justify-center rounded-lg border border-black/10 bg-white text-xl font-semibold text-tinta shadow-sm transition active:scale-95 active:bg-black/[0.06] ${ancho || 'flex-1'}`}
    >
      {children}
    </button>
  )

  return (
    <div
      data-teclado
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-fondo/95 p-3 backdrop-blur-xl"
    >
      <div className="flex w-full flex-col gap-2">
        {FILAS_MIN.map((fila, i) => (
          <div key={i} className="flex gap-2">
            {/* Mayúsculas (ancha) al inicio de la fila inferior, como un teclado real. */}
            {i === 3 && (
              <Tecla ancho="w-28" onTap={() => setMayus((m) => !m)}>
                <span className={mayus ? 'text-acento' : ''}>⇧ Mayús</span>
              </Tecla>
            )}
            {fila.map((k) => {
              const esLetra = /^[a-zñ]$/.test(k)
              const etiqueta = esLetra && mayus ? k.toUpperCase() : k
              return (
                <Tecla key={k} onTap={() => insertar(etiqueta)}>
                  {etiqueta}
                </Tecla>
              )
            })}
            {/* Borrar (ancha) al final de la fila de números, arriba a la derecha. */}
            {i === 0 && (
              <Tecla ancho="w-28" onTap={borrar}>
                ⌫
              </Tecla>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Tecla ancho="w-28" onTap={cerrar}>
            Cerrar
          </Tecla>
          <Tecla onTap={() => insertar(' ')}>espacio</Tecla>
          <Tecla ancho="w-28" onTap={listo}>
            ✓ Listo
          </Tecla>
        </div>
      </div>
    </div>
  )
}
