import { Icono, type NombreIcono } from '@renderer/components/Icono'

// Piezas de diseño compartidas para dar a todas las pantallas el mismo acabado
// que Reportes: encabezado consistente, tarjetas/paneles y estado vacío. Estética
// estilo Apple (rounded-2xl, hairline, sombra sutil).

/**
 * Encabezado de pantalla. El título del screen ya se muestra grande y centrado en
 * la barra superior, así que aquí solo va el subtítulo y las acciones (para no
 * duplicar el título). Se conserva `titulo` en las props por compatibilidad.
 */
export function EncabezadoPagina({
  subtitulo,
  children
}: {
  titulo?: string
  subtitulo?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      {subtitulo ? <p className="text-sm text-tinta-suave">{subtitulo}</p> : <div />}
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  )
}

/** Panel/tarjeta blanca con título opcional, igual que los de Reportes. */
export function Panel({
  titulo,
  children,
  className = '',
  cuerpoClassName = 'mt-3'
}: {
  titulo?: string
  children: React.ReactNode
  className?: string
  cuerpoClassName?: string
}): React.JSX.Element {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm ${className}`}>
      {titulo && <h2 className="text-sm font-bold text-tinta">{titulo}</h2>}
      <div className={titulo ? cuerpoClassName : ''}>{children}</div>
    </section>
  )
}

/**
 * Segmented control estilo iOS con indicador deslizante: la pastilla blanca se
 * mueve suave de una pestaña a otra (sin cortes). Las pestañas son de igual
 * ancho, así que el indicador se posiciona con translateX por índice.
 */
export function Pestanas<T extends string>({
  opciones,
  valor,
  onChange,
  className = ''
}: {
  opciones: readonly { id: T; label: string }[]
  valor: T
  onChange: (id: T) => void
  className?: string
}): React.JSX.Element {
  // idx -1 = ningún valor coincide (p. ej. un rango personalizado): se oculta el
  // indicador en vez de forzarlo sobre la primera opción.
  const idx = opciones.findIndex((o) => o.id === valor)
  const activo = idx >= 0
  return (
    <div className={`relative flex rounded-xl bg-black/[0.05] p-1 ${className}`}>
      {/* Indicador deslizante */}
      <div
        className="pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-white shadow-sm transition-[transform,opacity] duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${opciones.length})`,
          transform: `translateX(${Math.max(0, idx) * 100}%)`,
          opacity: activo ? 1 : 0
        }}
      />
      {opciones.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`relative z-10 flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
            valor === o.id ? 'text-acento' : 'text-tinta-suave hover:text-tinta'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Estado vacío centrado con ícono en pastilla, título y texto de apoyo. */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  children
}: {
  icono: NombreIcono
  titulo: string
  descripcion?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-tinta-suave">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04]">
        <Icono nombre={icono} size={32} className="text-tinta-suave/50" />
      </div>
      <p className="mt-4 font-semibold text-tinta">{titulo}</p>
      {descripcion && <p className="mt-0.5 text-sm">{descripcion}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
