// Iconos de línea monocromáticos (heredan currentColor). Sin dependencias.
// Estilo sobrio para una interfaz profesional.

export type NombreIcono =
  | 'mesas'
  | 'cobro'
  | 'corte'
  | 'catalogo'
  | 'efectivo'
  | 'tarjeta'
  | 'transferencia'
  | 'editar'
  | 'eliminar'
  | 'buscar'
  | 'imprimir'
  | 'mas'
  | 'check'
  | 'alerta'
  | 'cerrar'
  | 'recibo'
  | 'volver'
  | 'info'
  | 'finanzas'
  | 'gasto'
  | 'usuarios'
  | 'salir'
  | 'ajustes'
  | 'recargar'

interface Props {
  nombre: NombreIcono
  size?: number
  className?: string
}

const paths: Record<NombreIcono, React.ReactNode> = {
  mesas: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M7 16v4M17 16v4M3 11h18" />
    </>
  ),
  cobro: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  corte: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M13 16V8M18 16v-6" />
    </>
  ),
  catalogo: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
    </>
  ),
  efectivo: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  tarjeta: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  transferencia: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  editar: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  eliminar: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  imprimir: (
    <>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alerta: (
    <>
      <path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  cerrar: <path d="M18 6 6 18M6 6l12 12" />,
  recibo: (
    <>
      <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  volver: <path d="M19 12H5M12 19l-7-7 7-7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  finanzas: (
    <>
      <path d="M3 7h18v12H3zM3 7l2-3h14l2 3" />
      <path d="M16 13h.01" />
    </>
  ),
  gasto: (
    <>
      <path d="M12 3v18" />
      <path d="M7 8l5-5 5 5" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.8M17.5 20a5.5 5.5 0 0 0-3-4.9" />
    </>
  ),
  salir: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  recargar: (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v5h-5" />
    </>
  )
}

export function Icono({ nombre, size = 18, className }: Props): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[nombre]}
    </svg>
  )
}
