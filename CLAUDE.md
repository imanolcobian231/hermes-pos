# Ankyra POS — guía para Claude

POS de escritorio (Electron) en español para taquerías/restaurantes y tienditas de México.
Marca **Ankyra** (antes "Hermes"; el repo en disco se llama `hermes`). Paquete: `ankyra-pos`.
Ícono de la app = monograma **"KY"** (`resources/icon.png`).

> Lee también `ESTADO.md` (estado vivo: qué se construye, decisiones, pendientes).
> Este archivo es la arquitectura estable. Para retomar tras `/clear`: comando `/retomar`.

## Repos, versiones y ediciones
- **`imanolcobian231/hermes-pos`** (GitHub, público) = edición **RESTAURANTE**. Esta carpeta.
  `main` en **v0.7.0**. Colaborador con push: **AndresVelascoRo**.
- **`AndresVelascoRo/AnkyraShop-POS`** (privado) = edición **TIENDITA/ABARROTES**, un **fork**
  de este código (~0.6.0) que desarrolla Andrés en su rama `main`. Divergió: tiene multi-almacén,
  compras/proveedores, predicción de ventas, vendedores/comisiones, báscula COM, clave corta,
  precios por grupo. **No hay mesas/comandas/recetas ahí.** Ojo: son 2 codebases separados →
  los fixes transversales (cobro, corte, tickets, impresión) hay que replicarlos en ambos.
- **`imanolcobian231/ankyra-landing`** (privado) = landing en **Astro** (estática). Carpeta
  `C:\Users\imano\OneDrive\Desktop\ankyra-landing`. Tiene selector Restaurante/Tiendita y planes
  Lite/Pro/Max. Deploy pendiente (Vercel, importar repo). WhatsApp/precios con TODO por ajustar.
- **Entrega a cliente:** la v0.6.0 entregada está congelada en el tag `v0.6.0` y la rama
  `mantenimiento-0.6.0`, y clonada dev-ready en **`C:\Ankyra-cliente-0.6.0`** (para parchear al
  cliente sin meter features nuevas de main).
- Autor git local: "Imanol" / imanolcobianlz@gmail.com. Commits terminan con el Co-Authored-By.

## Stack
- **Electron + electron-vite**. `npm run dev` levanta todo (main + preload + renderer con HMR).
- **Main** (`src/main`): Node. DB `better-sqlite3` (SQLite, WAL). IPC vía `ipcMain.handle`.
- **Renderer** (`src/renderer`): React 19 + TypeScript + **Tailwind CSS v4**.
- **Shared** (`src/shared`): tipos y utilidades de main y renderer (`types.ts`, `canales.ts`,
  `pagos.ts`, `impuestos.ts`, `ticket.ts`).

## Flujo de dev (IMPORTANTE)
- **Renderer** (`src/renderer`) → hot-reload, no reinicia.
- **Main / preload / shared** → **reiniciar `npm run dev`** para que compile. Si un cambio del
  main "no se refleja", casi siempre el dev está viejo: reiniciar.
- Reinicio típico: matar `electron.exe` y `node.exe`, `npm run dev` en background, esperar ~15s,
  confirmar ~4 procesos electron y Vite en `http://localhost:5173`.
- **Siempre** `npm run typecheck` antes de cerrar un cambio (no corre eslint; tsc node + web).

## Base de datos
- Archivo: `%APPDATA%\ankyra-pos\ankyra.db`. NO consultable desde node del sistema (ABI mismatch
  de `better-sqlite3`, NODE_MODULE_VERSION): consultar solo vía la app. `postinstall` recompila
  `better-sqlite3` para Electron (`electron-rebuild`).
- Esquema en `src/main/db/esquema.ts`; migraciones **aditivas** (`ALTER TABLE`) en
  `migraciones.ts`; mapeo fila→objeto en `mapeo.ts`; datos iniciales en `seed.ts` (solo una
  categoría "Todos" si no hay categorías).
- Config de impresoras/negocio = JSON en tabla `config` (clave `impresoras`).

## Estructura del código
- `src/main/repos/` — datos por dominio: `ordenes`, `catalogo`, `mesas`, `cortes`, `gastos`,
  `reportes`, `config`, `creditos`, `inventario`, `usuarios`, `cancelaciones`, `reimpresiones`.
- `src/main/printer/` — ESC/POS (`tickets.ts` arma bytes; `serial.ts` COM/Windows por PowerShell).
  Negritas = `\x1bE\x01`…`\x1bE\x00`; texto en cp850 (iconv).
- `src/renderer/src/pages/` — `Mesas`, `Pedidos`, `Cobro`, `Tienda` (modo tiendita), `Corte`
  (llamado "Finanzas"), `Reportes`, `Catalogo`, `Inventario`, `Gastos`, `Clientes`, `Ajustes`,
  `Login`, `Usuarios`.
- `src/renderer/src/store/` — `datos` (`useDatos`), `impresion` (`useImpresion`; también aplica
  el tema oscuro), `auth`, `autorizacion` (PIN para acciones sensibles).
- `src/renderer/src/components/` — Modal (portal a body; cierra por mousedown en el fondo),
  Select (dropdown propio), Pestanas (segmented deslizante), TicketFinal, TicketCocina,
  DescuentoLineaDialog, etc.
- `src/renderer/src/lib/` — `format`, `comandas` (expandirCombos, comandasPorArea), `escaner`
  (lector de código de barras), `importar` (Excel/CSV), `colores`, `logo`.

## Subsistemas clave (los que más se tocan)
- **Impresión**: BLE (Web Bluetooth, `impresion.tsx`) es la ruta principal; COM/Windows por
  PowerShell (`serial.ts`). Varias impresoras por rol (Caja/Cocina/Barra); comanda se rutea por
  la categoría del producto. Banner de estado en `App.tsx`.
- **Inventario**: insumos con stock/costo + **recetas** (`producto_insumos`): al vender se
  descuentan insumos (`ordenes.ajustarInsumosReceta`). Productos con `controlar_stock` descuentan
  su propio stock. **Control de sobreventa**: `exigirStockDisponible` impide vender más que el
  stock (en `agregarProducto`/`cambiarCantidad`).
- **Código de barras**: `productos.codigo_barras` + `lib/escaner.ts` (detecta ráfaga del lector);
  escaneo global en `App.tsx` (modo tiendita) lleva a Venta y agrega; se ignora si el foco está
  en un campo.
- **Venta rápida / línea libre**: `ordenes.agregarLineaLibre` inserta una línea con
  **`producto_id = 0`** (centinela, sin FK) → monto libre sin registrar producto; no toca
  inventario/recetas/combos. En Pedidos va al comensal activo y entra al flujo de cocina; en la
  comanda las líneas libres muestran el **monto** ("$50 Frijoles"), no "1 x".
- **Combos**: producto a precio fijo (`es_combo` + `combo_items`); comanda lo desglosa
  (`expandirCombos`).
- **Tema oscuro**: `cfg.tema` ('claro'|'oscuro'), toggle en Ajustes; `impresion.tsx` aplica la
  clase `.dark` en `<html>` (Tailwind `@custom-variant dark`).
- **Propinas fuera de "ventas"** en reportes/corte; cuadre de caja mantiene el efectivo completo.

## Diseño (tokens en `src/renderer/src/assets/main.css`)
- `--color-acento` #0f4c5c (teal), `--color-fondo` #f5f5f7, `--color-tinta` #1d1d1f,
  `--color-tinta-suave` #6e6e73. Estética estilo Apple. Soporta modo oscuro (`.dark`).

## Convenciones
- Todo el producto (UI, comentarios, commits) va **en español**.
- Solución más simple posible (skills `ponytail`; evitar sobre-ingeniería).
- El código nuevo lee como el de alrededor (mismo estilo y densidad de comentarios).

## Distribución
- Sin instalador NSIS (Defender/UAC/SmartScreen lo bloqueaban). **ZIP portable**:
  `npm run portable` → `electron-vite build` + `electron-builder --dir` +
  `scripts/empaquetar-portable.mjs` (copia a `C:\Ankyra`, zip en
  `C:\ankyra-build\Ankyra-portable.zip`). `better-sqlite3` en `asarUnpack`.
- Instrucciones para el cliente en `INSTALAR.txt` y `ACTUALIZAR.txt` (raíz). Actualizar =
  reemplazar solo la carpeta con `Ankyra.exe`; los datos en `%APPDATA%\ankyra-pos` no se tocan.
- App sin firmar → el cliente verá SmartScreen ("Más información → Ejecutar de todas formas").

## Entorno (gotchas)
- Windows 11, PowerShell (primario) + Bash (git-bash). Para medir disco usar `df -m /c` / `du`
  (PowerShell puede colgarse si el disco está saturado). El disco estuvo lleno; se acotó el
  pagefile a 4–8 GB y se limpiaron cachés.
- No puedo desinstalar apps ni vaciar la Papelera (lo hace el usuario).

## Roadmap
- Ankyra se migrará a **web** (SaaS multi-negocio/sucursal). La landing ya prepara esa narrativa.
