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

/** Lista las impresoras instaladas en Windows (cola de impresión: USB, red, etc.). */
export async function listarImpresorasWindows(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  try {
    const salida = await correrPowershell(
      'Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name'
    )
    return salida
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

// Ayudante en C# (P/Invoke a winspool) para enviar bytes crudos a una impresora de
// Windows en modo RAW. Así se imprimen tickets ESC/POS por USB o red usando la cola
// de impresión de Windows, sin drivers del fabricante ni módulos nativos de Node.
const HELPER_RAW = `using System;
using System.Runtime.InteropServices;
public class AnkyraRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("No se pudo abrir la impresora: " + printer);
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "Ankyra Ticket"; di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, ref di)) throw new Exception("StartDocPrinter fallo");
      if (!StartPagePrinter(h)) throw new Exception("StartPagePrinter fallo");
      int w; if (!WritePrinter(h, bytes, bytes.Length, out w)) throw new Exception("WritePrinter fallo");
      EndPagePrinter(h); EndDocPrinter(h);
    } finally { ClosePrinter(h); }
  }
}`

/** Envía bytes crudos (ESC/POS) a una impresora de Windows por su nombre (cola RAW). */
export async function enviarAImpresoraWindows(nombre: string, datos: number[]): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('La impresión por Windows solo está disponible en Windows')
  }
  if (!nombre?.trim()) throw new Error('Falta el nombre de la impresora de Windows')

  const base = join(tmpdir(), `ankyra-win-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const archivoBin = base + '.bin'
  const archivoPs1 = base + '.ps1'
  await writeFile(archivoBin, Buffer.from(datos))

  const nombreEsc = nombre.replace(/'/g, "''")
  const rutaBin = archivoBin.replace(/'/g, "''")
  // El helper C# va en un here-string literal (@' ... '@); el cierre '@ debe ir en
  // la columna 0. Se ejecuta el script desde un .ps1 para evitar problemas de
  // escape al pasar C# multilínea por -Command.
  const ps1 =
    `$ErrorActionPreference='Stop'\r\n$src = @'\r\n` +
    HELPER_RAW.replace(/\r?\n/g, '\r\n') +
    `\r\n'@\r\n` +
    `Add-Type -TypeDefinition $src -Language CSharp\r\n` +
    `$bytes = [System.IO.File]::ReadAllBytes('${rutaBin}')\r\n` +
    `[AnkyraRawPrinter]::Send('${nombreEsc}', $bytes)\r\n`
  await writeFile(archivoPs1, ps1, 'utf8')

  try {
    await correrPowershell(`& '${archivoPs1.replace(/'/g, "''")}'`)
  } finally {
    void unlink(archivoBin).catch(() => {})
    void unlink(archivoPs1).catch(() => {})
  }
}

/** Envía bytes crudos (ESC/POS) a un puerto COM con los baudios indicados. */
export async function enviarAPuerto(puerto: string, baudRate: number, datos: number[]): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('La impresión por COM solo está disponible en Windows')
  }
  const com = puerto.trim().toUpperCase()
  if (!/^COM\d+$/.test(com)) throw new Error(`Puerto inválido: ${puerto}`)

  const archivo = join(tmpdir(), `ankyra-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`)
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
