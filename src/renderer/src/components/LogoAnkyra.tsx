import logo from '@renderer/assets/ankyra-logo.png'

// Logo de marca de Ankyra (imagen a color).
export function LogoAnkyra({ className }: { className?: string }): React.JSX.Element {
  return <img src={logo} alt="Ankyra" className={className} draggable={false} />
}
