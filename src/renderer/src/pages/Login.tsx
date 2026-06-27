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
    <div className="flex h-screen items-center justify-center bg-fondo text-tinta">
      <div className="w-[22rem] rounded-3xl border border-black/[0.06] bg-superficie p-8 shadow-xl shadow-black/5">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LogoHermes className="w-3/4 object-contain" />
          <div className="text-sm text-tinta-suave">
            {hayUsuarios ? 'Inicia sesión para continuar' : 'Configura tu negocio'}
          </div>
        </div>

        {cargando ? (
          <div className="flex justify-center py-6 text-tinta-suave">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-tinta" />
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
        <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
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
            className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-superficie px-4 py-3 text-left shadow-sm transition hover:bg-black/[0.03]"
          >
            <span className="font-semibold text-tinta">{u.nombre}</span>
            <span className="text-xs uppercase text-tinta-suave">{u.rol}</span>
          </button>
        ))}
        {usuarios.length === 0 && (
          <p className="text-center text-sm text-tinta-suave">No hay usuarios.</p>
        )}
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
        className="mb-4 flex items-center gap-1 text-sm font-medium text-tinta-suave transition hover:text-tinta"
      >
        <Icono nombre="volver" size={14} />
        {seleccionado.nombre}
      </button>

      <PuntosPin longitud={pin.length} error={error} />
      {error && <p className="mb-3 text-sm font-medium text-red-600">PIN incorrecto</p>}

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
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.03] px-4 py-3 text-center text-xs text-tinta-suave">
          No hay ningún usuario todavía. Crea el administrador del negocio; después podrás agregar a
          los empleados desde <strong className="text-tinta">Usuarios</strong>.
        </div>
        <div>
          <label className="mb-1 block px-1 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
            Nombre del administrador
          </label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Encargado"
            className="campo"
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" className="btn-primario w-full">
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
        className="mb-4 flex items-center gap-1 text-sm font-medium text-tinta-suave transition hover:text-tinta"
      >
        <Icono nombre="volver" size={14} />
        {nombre.trim() || 'Administrador'}
      </button>

      <p className="mb-4 text-sm font-medium text-tinta">
        {fase === 'crear' ? 'Crea un PIN de 4 dígitos' : 'Confirma tu PIN'}
      </p>

      <PuntosPin longitud={pin.length} error={!!error} />
      {error && <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p>}

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
          className={`h-3.5 w-3.5 rounded-full border transition ${
            error
              ? 'border-red-500'
              : i < longitud
                ? 'border-acento bg-acento'
                : 'border-black/25'
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
      className="h-16 w-16 rounded-full border border-black/[0.08] bg-superficie text-xl font-semibold text-tinta shadow-sm transition hover:bg-black/[0.03] active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
