# Ankyra POS — guía para Claude

POS de escritorio (Electron) en español para taquerías/restaurantes y tienditas de México.
La marca es **Ankyra** (antes "Hermes"; el repo aún se llama `hermes` en disco). Paquete: `ankyra-pos`.

> Antes de trabajar lee también `ESTADO.md` (estado vivo del proyecto: qué se está
> construyendo, decisiones y pendientes). Este archivo es la arquitectura estable.

## Stack
- **Electron + electron-vite**. `npm run dev` levanta todo (main + preload + renderer con HMR).
- **Main** (`src/main`): Node. DB `better-sqlite3` (SQLite, WAL). IPC vía `ipcMain.handle`.
- **Renderer** (`src/renderer`): React 19 + TypeScript + **Tailwind CSS v4**.
- **Shared** (`src/shared`): tipos y utilidades usadas por main y renderer (`types.ts`,
  `canales.ts`, `pagos.ts`, `impuestos.ts`, `ticket.ts`).

## Flujo de dev (IMPORTANTE)
- **Renderer** (archivos en `src/renderer`) → hot-reload, no requiere reiniciar.
- **Main / preload / shared** → **hay que reiniciar `npm run dev`** para que compile.
  Si un cambio del main "no se refleja", casi siempre es que el dev está viejo: reiniciar.
- Reinicio típico: matar `electron.exe` y `node.exe`, luego `npm run dev` en background,
  esperar ~15s y confirmar que hay ~4 procesos electron y Vite en `http://localhost:5173`.
- **Siempre** correr `npm run typecheck` antes de dar por terminado un cambio.

## Base de datos
- Archivo: `%APPDATA%\ankyra-pos\ankyra.db`. NO se puede consultar desde node del sistema
  (mismatch de ABI de `better-sqlite3`, NODE_MODULE_VERSION): consultar solo vía la app.
- Esquema en `src/main/db/esquema.ts`; migraciones **aditivas** (`ALTER TABLE`) en
  `migraciones.ts`; mapeo fila→objeto en `mapeo.ts`; datos iniciales en `seed.ts`
  (solo crea una categoría "Todos" si no hay categorías; sin mesas ni productos).
- Config de impresoras/negocio guardada como JSON en la tabla `config` (clave `impresoras`).

## Estructura del código
- `src/main/repos/` — acceso a datos por dominio: `ordenes`, `catalogo`, `mesas`,
  `cortes`, `gastos`, `reportes`, `config`, `creditos`, `inventario`, `usuarios`,
  `cancelaciones`, `reimpresiones`.
- `src/main/printer/` — impresión térmica ESC/POS (`tickets.ts` arma bytes; `serial.ts`).
  Negritas ESC/POS = `\x1bE\x01` … `\x1bE\x00`, texto codificado en cp850 (iconv).
- `src/renderer/src/pages/` — pantallas: `Mesas`, `Pedidos`, `Cobro`, `Tienda` (modo
  tiendita), `Corte`, `Reportes`, `Catalogo`, `Inventario`, `Gastos`, `Clientes`,
  `Finanzas`, `Ajustes`, `Login`, `Usuarios`.
- `src/renderer/src/store/` — contextos: `datos` (`useDatos`), `impresion`
  (`useImpresion`), `auth`, `autorizacion` (PIN para acciones sensibles).
- `src/renderer/src/components/` — UI reutilizable (Modal, TicketFinal, TicketCocina,
  RangoFechas, TicketsRecientes, HistorialMesa, CantidadEditable, etc.).

## Diseño (tokens en `src/renderer/src/assets/main.css`)
- `--color-acento` #0f4c5c (teal oscuro), `--color-fondo` #f5f5f7,
  `--color-tinta` #1d1d1f, `--color-tinta-suave` #6e6e73. Estética estilo Apple.

## Convenciones
- Todo el producto (UI, comentarios, mensajes) va **en español**.
- Solucionar de la forma más simple posible (skills `ponytail` instaladas para forzar
  soluciones mínimas; evitar sobre-ingeniería).
- Cambios de código deben leer como el código de alrededor (mismo estilo y densidad de
  comentarios).

## Distribución
- Se abandonó el instalador NSIS (Windows Defender/UAC/SmartScreen lo bloqueaban).
- Distribución actual: **ZIP portable**. `npm run portable` → `electron-vite build` +
  `electron-builder --dir` + `scripts/empaquetar-portable.mjs` (copia a `C:\Ankyra`,
  zip en `C:\ankyra-build\Ankyra-portable.zip`). `better-sqlite3` va en `asarUnpack`.

## Roadmap
- Ankyra se migrará pronto a **web**.
