// Empaqueta la app compilada como versión portable:
//   1. Copia el build (win-unpacked) a C:\Ankyra (fuera de OneDrive, corre rápido).
//   2. Regenera C:\ankyra-build\Ankyra-portable.zip para pasarla a otra PC.
//
// El build en sí lo hace `electron-vite build && electron-builder --dir` antes de
// llamar a este script (ver npm run portable). Aquí solo se copia y comprime.
//
// Se usa una versión portable en vez del instalador NSIS porque el Windows Defender
// de este equipo bloquea el instalador firmado con certificado propio; el .exe de
// la app sí corre sin problema.

import { rmSync, cpSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ORIGEN = 'C:\\ankyra-build\\dist\\win-unpacked'
const DESTINO = 'C:\\Ankyra'
const ZIP = 'C:\\ankyra-build\\Ankyra-portable.zip'
const TAR = 'C:\\Windows\\System32\\tar.exe' // bsdtar nativo de Windows (soporta zip)

if (!existsSync(ORIGEN)) {
  console.error(`\n✗ No existe el build en ${ORIGEN}`)
  console.error('  Corre primero el build (o usa `npm run portable`, que lo hace).')
  process.exit(1)
}

// Cierra la app si está abierta, para no chocar con archivos bloqueados al copiar.
try {
  execFileSync('taskkill', ['/F', '/IM', 'Ankyra.exe', '/T'], { stdio: 'ignore' })
} catch {
  /* no estaba abierta: ok */
}

console.log(`Actualizando ${DESTINO} ...`)
rmSync(DESTINO, { recursive: true, force: true })
cpSync(ORIGEN, DESTINO, { recursive: true })

console.log(`Generando ${ZIP} ...`)
rmSync(ZIP, { force: true })
execFileSync(TAR, ['-a', '-c', '-f', ZIP, '-C', 'C:\\', 'Ankyra'], { stdio: 'inherit' })

console.log('\n✓ Listo:')
console.log(`  App portable:  ${DESTINO}\\Ankyra.exe`)
console.log(`  ZIP para otra PC:  ${ZIP}`)
