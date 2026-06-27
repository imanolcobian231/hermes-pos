import logo from '@renderer/assets/hermes-logo.png'

// Logo de marca de Hermes (imagen a color).
export function LogoHermes({ className }: { className?: string }): React.JSX.Element {
  return <img src={logo} alt="Hermes" className={className} draggable={false} />
}
