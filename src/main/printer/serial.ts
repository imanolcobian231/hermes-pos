import { spawn } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Impresión por Bluetooth Clásico / puerto COM en Windows, SIN dependencias
// nativas ni drivers del fabricante: se usa PowerShell + .NET
// (System.IO.Ports.SerialPort), que viene incluido en Windows. Una impresora
// Bluetooth Clásico (ej. PT-210) emparejada en Windows expone un puerto COM.

function correrPowershell(script: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true }
    )
    let salida = ''
    let error = ''
    const temporizador = setTimeout(() => {
      ps.kill()
      reject(new Error('Tiempo de espera agotado al comunicar con la impresora'))
    }, timeoutMs)
    ps.stdout.on('data', (d) => (salida += d.toString()))
    ps.stderr.on('data', (d) => (error += d.toString()))
    ps.on('error', (e) => {
      clearTimeout(temporizador)
      reject(e)
    })
    ps.on('close', (code) => {
      clearTimeout(temporizador)
      if (code === 0) resolve(salida)
      else reject(new Error(error.trim() || `PowerShell terminó con código ${code}`))
    })
  })
}

/** Lista los puertos COM disponibles (incluye los Bluetooth ya emparejados). */
export async function listarPuertos(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  try {
    const salida = await correrPowershell('[System.IO.Ports.SerialPort]::GetPortNames() -join ","')
    const puertos = salida
      .trim()
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    return [...new Set(puertos)].sort(
      (a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0)
    )
  } catch {
    return []
  }
}

/** Envía bytes crudos (ESC/POS) a un puerto COM con los baudios indicados. */
export async function enviarAPuerto(puerto: string, baudRate: number, datos: number[]): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('La impresión por COM solo está disponible en Windows')
  }
  const com = puerto.trim().toUpperCase()
  if (!/^COM\d+$/.test(com)) throw new Error(`Puerto inválido: ${puerto}`)

  const archivo = join(tmpdir(), `hermes-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`)
  await writeFile(archivo, Buffer.from(datos))
  try {
    const script = [
      `$ErrorActionPreference='Stop'`,
      `$p=New-Object System.IO.Ports.SerialPort('${com}',${baudRate || 9600},[System.IO.Ports.Parity]::None,8,[System.IO.Ports.StopBits]::One)`,
      `$p.Handshake=[System.IO.Ports.Handshake]::None`,
      `$p.DtrEnable=$true`,
      `$p.RtsEnable=$true`,
      `$p.WriteTimeout=8000`,
      `$p.Open()`,
      `$b=[System.IO.File]::ReadAllBytes('${archivo.replace(/\\/g, '\\\\')}')`,
      `$p.Write($b,0,$b.Length)`,
      `Start-Sleep -Milliseconds 500`,
      `$p.Close()`
    ].join('; ')
    await correrPowershell(script)
  } finally {
    void unlink(archivo).catch(() => {})
  }
}
