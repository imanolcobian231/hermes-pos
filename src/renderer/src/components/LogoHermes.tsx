import logo from '@renderer/assets/hermes-logo.svg'

// Filtro que tiñe el SVG (negro) al color de marca de Hermes.
const FILTRO =
  'brightness(0) saturate(100%) invert(15%) sepia(91%) saturate(3198%) hue-rotate(221deg) brightness(95%) contrast(83%)'

export function LogoHermes({ className }: { className?: string }): React.JSX.Element {
  return <img src={logo} alt="Hermes" className={className} style={{ filter: FILTRO }} draggable={false} />
}
