import { useEffect, useState } from 'react'
import type { Usuario } from '@shared/types'
import { useAuth } from '@renderer/store/auth'
import { Icono } from '@renderer/components/Icono'
import { LogoHermes } from '@renderer/components/LogoHermes'

export function Login(): React.JSX.Element {
  const [cargando, setCargando] = useState(true)
  const [hayUsuarios, setHayUsuarios] = useState(false)

  useEffect(() => {
    void (async () => {
      setHayUsuarios(await window.api.usuarios.hayUsuarios())
      setCargando(false)
    })()
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-80">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 p-2">
            <LogoHermes className="h-full w-full object-contain" />
          </span>
          <div className="text-center">
            <div className="text-lg font-semibold tracking-wide">Hermes</div>
            <div className="text-xs text-slate-500">
              {hayUsuarios ? 'Inicia sesión para continuar' : 'Configura tu negocio'}
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-6 text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-100" />
          </div>
        ) : hayUsuarios ? (
          <InicioSesion />
        ) : (
          <PrimerAdmin />
        )}
      </div>
    </div>
  )
}

// --- Inicio de sesión normal (ya hay usuarios) -----------------------------

function InicioSesion(): React.JSX.Element {
  const { login } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    void (async () => {
      const lista = await window.api.usuarios.listar()
      setUsuarios(lista)
      if (lista.length === 1) setSeleccionado(lista[0])
    })()
  }, [])

  const teclear = (d: string): void => {
    setError(false)
    setPin((p) => (p.length >= 6 ? p : p + d))
  }

  const intentar = async (pinFinal: string): Promise<void> => {
    if (!seleccionado) return
    setVerificando(true)
    const ok = await login(seleccionado.id, pinFinal)
    setVerificando(false)
    if (!ok) {
      setError(true)
      setPin('')
    }
  }

  // Auto-verifica al llegar a 4 dígitos.
  useEffect(() => {
    if (pin.length === 4) void intentar(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  if (!seleccionado) {
    return (
      <div className="flex flex-col gap-2">
        <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          ¿Quién eres?
        </div>
        {usuarios.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              setSeleccionado(u)
              setPin('')
              setError(false)
            }}
            className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-left hover:bg-slate-800"
          >
            <span className="font-semibold">{u.nombre}</span>
            <span className="text-xs uppercase text-slate-500">{u.rol}</span>
          </button>
        ))}
        {usuarios.length === 0 && <p className="text-center text-sm text-slate-500">No hay usuarios.</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => {
          setSeleccionado(null)
          setPin('')
          setError(false)
        }}
        className="mb-3 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <Icono nombre="volver" size={14} />
        {seleccionado.nombre}
      </button>

      <PuntosPin longitud={pin.length} error={error} />
      {error && <p className="mb-3 text-sm text-red-400">PIN incorrecto</p>}

      <TecladoPin
        onTecla={teclear}
        onLimpiar={() => setPin('')}
        onBorrar={() => setPin((p) => p.slice(0, -1))}
        disabled={verificando}
      />
    </div>
  )
}

// --- Configuración del primer administrador (instalación nueva) ------------

function PrimerAdmin(): React.JSX.Element {
  const { crearPrimerAdmin } = useAuth()
  const [fase, setFase] = useState<'nombre' | 'crear' | 'confirmar'>('nombre')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [pinPrimero, setPinPrimero] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const teclear = (d: string): void => {
    setError('')
    setPin((p) => (p.length >= 4 ? p : p + d))
  }

  // Avanza automáticamente al completar 4 dígitos en cada fase.
  useEffect(() => {
    if (pin.length !== 4) return
    if (fase === 'crear') {
      setPinPrimero(pin)
      setPin('')
      setFase('confirmar')
    } else if (fase === 'confirmar') {
      if (pin === pinPrimero) void finalizar(pin)
      else {
        setError('Los PIN no coinciden, intenta de nuevo')
        setPin('')
        setPinPrimero('')
        setFase('crear')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const finalizar = async (pinFinal: string): Promise<void> => {
    setGuardando(true)
    try {
      await crearPrimerAdmin(nombre, pinFinal)
      // El auto-login monta el resto de la app automáticamente.
    } catch (e) {
      setGuardando(false)
      setError(e instanceof Error ? e.message : 'No se pudo crear el administrador')
      setPin('')
      setPinPrimero('')
      setFase('crear')
    }
  }

  if (fase === 'nombre') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!nombre.trim()) {
            setError('Escribe un nombre')
            return
          }
          setError('')
          setFase('crear')
        }}
        className="flex flex-col gap-4"
      >
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-center text-xs text-slate-400">
          No hay ningún usuario todavía. Crea el administrador del negocio; después
          podrás agregar a los empleados desde <strong className="text-slate-200">Usuarios</strong>.
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Nombre del administrador
          </label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Encargado"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-400"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white"
        >
          Continuar
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => {
          setFase('nombre')
          setPin('')
          setPinPrimero('')
          setError('')
        }}
        className="mb-3 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <Icono nombre="volver" size={14} />
        {nombre.trim() || 'Administrador'}
      </button>

      <p className="mb-4 text-sm font-medium text-slate-300">
        {fase === 'crear' ? 'Crea un PIN de 4 dígitos' : 'Confirma tu PIN'}
      </p>

      <PuntosPin longitud={pin.length} error={!!error} />
      {error && <p className="mb-3 text-center text-sm text-red-400">{error}</p>}

      <TecladoPin
        onTecla={teclear}
        onLimpiar={() => setPin('')}
        onBorrar={() => setPin((p) => p.slice(0, -1))}
        disabled={guardando}
      />
    </div>
  )
}

// --- Componentes compartidos -----------------------------------------------

function PuntosPin({ longitud, error }: { longitud: number; error: boolean }): React.JSX.Element {
  return (
    <div className="mb-5 flex gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full border ${
            error
              ? 'border-red-500'
              : i < longitud
                ? 'border-slate-100 bg-slate-100'
                : 'border-slate-600'
          }`}
        />
      ))}
    </div>
  )
}

function TecladoPin({
  onTecla,
  onLimpiar,
  onBorrar,
  disabled
}: {
  onTecla: (d: string) => void
  onLimpiar: () => void
  onBorrar: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <BotonTecla key={d} onClick={() => onTecla(d)} disabled={disabled}>
          {d}
        </BotonTecla>
      ))}
      <BotonTecla onClick={onLimpiar} disabled={disabled}>
        C
      </BotonTecla>
      <BotonTecla onClick={() => onTecla('0')} disabled={disabled}>
        0
      </BotonTecla>
      <BotonTecla onClick={onBorrar} disabled={disabled}>
        ⌫
      </BotonTecla>
    </div>
  )
}

function BotonTecla({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 rounded-full bg-slate-900 text-xl font-semibold text-slate-100 transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
