# Graph Report - .  (2026-07-17)

## Corpus Check
- 4 files · ~80,790 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 746 nodes · 1112 edges · 72 communities (52 shown, 20 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Mapeo DB a Objetos
- Respaldos y Corte de Caja
- Tipos Compartidos (types.ts)
- Dependencias (package.json)
- DevDependencies de Build
- Config TypeScript (renderer)
- Decisiones de Producto (ESTADO.md)
- Config TypeScript (main/preload)
- DB: Conexion y Esquema
- Contexto de Impresion Bluetooth
- Repo de Usuarios
- Pantalla de Ajustes
- Repo de Inventario
- Cache de Logo/Assets
- Pantalla de Reportes
- Guia de Arquitectura (CLAUDE.md)
- App Shell y Navegacion
- Pantalla de Cobro
- Contexto de Datos (useDatos)
- Pantalla de Catalogo
- Componente RangoFechas
- Contexto de Auth/Autorizacion
- Pantalla de Inventario
- Calculo de Impuestos
- Componente TecladoVirtual
- Sistema de Toasts
- Utilidades de Formato
- Overview del Stack (README)
- Comandas de Cocina
- Datos y Respaldos (docs)
- Distribucion (electron-builder)
- Branding Ankyra/Olyssea
- Pantalla de Clientes
- Preload API Bridge
- Componente Icono
- Pantalla de Mesas
- Pantalla de Usuarios
- Estructura de Carpetas (docs)
- Componente TarjetaMesa
- Ticket de Cocina
- Utilidades de Ticket
- Impresion ESC/POS (docs)
- Componente AsignarGrupos
- Componente ConfirmDialog
- Componente CuadriculaVirtual
- Componente DescuentoLineaDialog
- Componente HistorialMesa
- Componente Modal
- Componente SelectorModificadores
- Componente TicketFinal
- Componente TicketsRecientes
- Pantalla de Pedidos
- Pantalla de Tienda
- Utilidades de Pagos
- Config TypeScript (root)
- Paleta de Colores
- Canales de Venta
- Tipos de Orden
- Icono de la App

## God Nodes (most connected - your core abstractions)
1. `obtenerDb()` - 84 edges
2. `ESTADO.md — estado vivo del proyecto Ankyra` - 30 edges
3. `obtenerConDetalle()` - 17 edges
4. `registrarIpc()` - 15 edges
5. `compilerOptions` - 14 edges
6. `CLAUDE.md — guía de arquitectura de Ankyra POS` - 14 edges
7. `scripts` - 13 edges
8. `compilerOptions` - 13 edges
9. `respaldar()` - 11 edges
10. `bytesFinal()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `README Stack: Electron, electron-vite, React, TS, Tailwind, SQLite, ESC/POS (simulación)` --semantically_similar_to--> `Stack: Electron + electron-vite + better-sqlite3 + React19/TS/Tailwind v4`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Estructura de carpetas: main/db, main/repos, main/ipc, main/printer, preload, renderer, shared` --semantically_similar_to--> `src/main/repos — acceso a datos por dominio`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Estructura de carpetas: main/db, main/repos, main/ipc, main/printer, preload, renderer, shared` --semantically_similar_to--> `src/renderer/src/pages — pantallas de la app`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Distribución: ZIP portable, NSIS abandonado (Defender/UAC/SmartScreen)` --conceptually_related_to--> `Config NSIS: oneClick, perMachine false, allowElevation false (instala en LOCALAPPDATA)`  [AMBIGUOUS]
  CLAUDE.md → electron-builder.yml
- `/retomar slash command` --references--> `ESTADO.md — estado vivo del proyecto Ankyra`  [EXTRACTED]
  .claude/commands/retomar.md → ESTADO.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Documentación de onboarding y retomar contexto del proyecto Ankyra** — claude_arquitectura_ankyra, estado_estado_proyecto, readme_ankyra_pos, claude_commands_retomar_comando_retomar [EXTRACTED 1.00]
- **Sistema de inventario por producto: recetas y combos (uno resuelto, otro pendiente)** — estado_combos_mvp, estado_combos_inventario_pendiente, estado_receta_insumos [INFERRED 0.80]
- **Flujo de distribución y actualización de Ankyra (ZIP portable)** — claude_distribucion_zip, electron_builder_asarunpack, electron_builder_nsis_config, actualizar_guia_actualizacion [INFERRED 0.85]

## Communities (72 total, 20 thin omitted)

### Community 0 - "Mapeo DB a Objetos"
Cohesion: 0.06
Nodes (71): obtenerDb(), aCancelacion(), aCategoria(), aCliente(), aGasto(), aGrupo(), aInsumo(), aMesa() (+63 more)

### Community 1 - "Respaldos y Corte de Caja"
Cohesion: 0.03
Nodes (57): Cancelacion, Categoria, CategoriaInput, CierreCorteInput, Cliente, ClienteInput, ComboItem, ConfigImpresoras (+49 more)

### Community 2 - "Tipos Compartidos (types.ts)"
Cohesion: 0.08
Nodes (44): configurarBluetooth(), cerrarDb(), crearEsquema(), inicializarDb(), purgarOrdenesVacias(), aCorte(), asegurarRolesPredefinidos(), columnas() (+36 more)

### Community 3 - "Dependencias (package.json)"
Cohesion: 0.05
Nodes (40): better-sqlite3, @fontsource-variable/inter, iconv-lite, author, dependencies, better-sqlite3, @fontsource-variable/inter, iconv-lite (+32 more)

### Community 4 - "DevDependencies de Build"
Cohesion: 0.06
Nodes (33): electron, electron-builder, @electron/rebuild, electron-vite, devDependencies, electron, electron-builder, @electron/rebuild (+25 more)

### Community 5 - "Config TypeScript (renderer)"
Cohesion: 0.17
Nodes (30): abrir(), abrirLlevar(), agregarProducto(), ahora(), ajustarInsumosReceta(), ajustarStockProductos(), cambiarCantidad(), cambiarMetodoPago() (+22 more)

### Community 6 - "Decisiones de Producto (ESTADO.md)"
Cohesion: 0.18
Nodes (22): exigirAdmin(), registrarIpc(), correrPowershell(), enviarAImpresoraWindows(), enviarAPuerto(), listarImpresorasWindows(), listarPuertos(), aBytes() (+14 more)

### Community 7 - "Config TypeScript (main/preload)"
Cohesion: 0.09
Nodes (23): DOM, DOM.Iterable, ES2020, src/preload/index.d.ts, src/renderer/src/*, compilerOptions, baseUrl, composite (+15 more)

### Community 8 - "DB: Conexion y Esquema"
Cohesion: 0.10
Nodes (22): Sistema de botones estandarizado (.btn-primario/.btn-neutro/.btn-peligro/.btn-texto), Caja con flujo estricto (2026-07-08): abrir caja obligatorio antes de cobrar, Cantidad editable en pedidos/tienda (CantidadEditable), Categoría 'Todos' por defecto del seed (obligatoria para crear productos), Cobro en modo restaurante: no pide método de pago, se corrige en Corte (cambiarMetodoPago), Código de barras / lector scanner (2026-07-10), escaneo global en modo tiendita, Pendiente: inventario de componentes de combos (descontar stock de partes), Combos (producto a precio fijo) MVP 2026-07-10: es_combo + combo_items (+14 more)

### Community 9 - "Contexto de Impresion Bluetooth"
Cohesion: 0.10
Nodes (21): electron.vite.config.ts, electron-vite/node, node, src/main/**/*, src/preload/**/*, compilerOptions, baseUrl, composite (+13 more)

### Community 10 - "Repo de Usuarios"
Cohesion: 0.17
Nodes (16): Aviso, conectarYBuscar(), conTimeout(), encontrarEscritura(), escribirBytes(), espera(), EstadoImpresora, FILTROS (+8 more)

### Community 11 - "Pantalla de Ajustes"
Cohesion: 0.26
Nodes (15): aUsuario(), bloqueado(), crearPrimerAdmin(), eliminar(), guardar(), hayUsuarios(), intentos, limpiarIntentos() (+7 more)

### Community 12 - "Repo de Inventario"
Cohesion: 0.12
Nodes (3): BAUDIOS, PestanaAj, PESTANAS_AJ

### Community 13 - "Cache de Logo/Assets"
Cohesion: 0.26
Nodes (10): cacheLogoAnkyra, cacheSocial, cargarImagen(), ICONOS_SOCIAL, iconoSocialDataUrl(), logoAnkyra(), pngALogo(), rasterizar() (+2 more)

### Community 14 - "Pantalla de Reportes"
Cohesion: 0.23
Nodes (8): COLOR_METODO, compacto(), Donut(), etiquetaDia(), HOY, INICIO_MES, isoLocal(), Reportes()

### Community 15 - "Guia de Arquitectura (CLAUDE.md)"
Cohesion: 0.18
Nodes (11): CLAUDE.md — guía de arquitectura de Ankyra POS, /retomar slash command, src/renderer/src/components — UI reutilizable, Convenciones: producto en español, soluciones mínimas (skills ponytail), Diseño: tokens de color en main.css, estética estilo Apple, Flujo de dev: renderer hot-reload vs. main/preload/shared requiere reinicio, Roadmap: migración de Ankyra a web, src/renderer/src/store — contextos (datos, impresion, auth, autorizacion) (+3 more)

### Community 16 - "App Shell y Navegacion"
Cohesion: 0.18
Nodes (4): NAV, PedidoActivo, TITULOS, Vista

### Community 17 - "Pantalla de Cobro"
Cohesion: 0.20
Nodes (7): Cobro(), METODOS, OPCIONES, pill(), Props, RAPIDOS, VACIO_MIXTO

### Community 18 - "Contexto de Datos (useDatos)"
Cohesion: 0.20
Nodes (7): api, ApiType, DatosContext, DatosContextValue, mensajeError(), ProveedorDatos(), RESUMEN_VACIO

### Community 19 - "Pantalla de Catalogo"
Cohesion: 0.31
Nodes (7): abr(), DIAS, inicioMes(), iso(), MESES, parse(), RangoFechas()

### Community 20 - "Componente RangoFechas"
Cohesion: 0.24
Nodes (6): AuthContext, AuthContextValue, useAuth(), AutorizacionContext, AutorizacionContextValue, ProveedorAutorizacion()

### Community 21 - "Contexto de Auth/Autorizacion"
Cohesion: 0.22
Nodes (5): FILTROS, FiltroTipo, PanelProductos(), Pestana, PESTANAS

### Community 22 - "Pantalla de Inventario"
Cohesion: 0.28
Nodes (5): DetalleInsumo(), DetalleProducto(), etiquetaMov, MOVS, UNIDADES

### Community 23 - "Calculo de Impuestos"
Cohesion: 0.25
Nodes (7): CENTENAS, ConfigImpuesto, DECENAS, DesgloseImpuesto, enteroALetras(), totalEnLetra(), UNIDADES

### Community 24 - "Componente TecladoVirtual"
Cohesion: 0.46
Nodes (7): Editable, editar(), esEditable(), fijarValor(), FILAS_MIN, TecladoVirtual(), TIPOS_TEXTO

### Community 25 - "Sistema de Toasts"
Cohesion: 0.25
Nodes (5): estilos, FnToast, ItemToast, TipoToast, ToastContext

### Community 26 - "Utilidades de Formato"
Cohesion: 0.29
Nodes (3): formateadorMXN, formatearTelefono(), LADAS_DOS_DIGITOS

### Community 27 - "Overview del Stack (README)"
Cohesion: 0.29
Nodes (7): Stack: Electron + electron-vite + better-sqlite3 + React19/TS/Tailwind v4, README.md — Ankyra POS overview, Módulos: Mesas, Pedidos, Cobro, Corte de caja, Catálogo, Requisitos: Node.js 20+, Windows, postinstall recompila better-sqlite3, README Stack: Electron, electron-vite, React, TS, Tailwind, SQLite, ESC/POS (simulación), Content-Security-Policy: default-src 'self', index.html — HTML shell del renderer

### Community 28 - "Comandas de Cocina"
Cohesion: 0.29
Nodes (3): AreaComanda, GrupoComanda, RolesImpresion

### Community 30 - "Datos y Respaldos (docs)"
Cohesion: 0.40
Nodes (6): Carpeta de datos %APPDATA%\ankyra-pos (persiste al actualizar), Guía de actualización de Ankyra (ACTUALIZAR.txt), Respaldo manual: Ajustes → Respaldos → Respaldar ahora, Aviso Windows SmartScreen (app sin firma digital), Base de datos SQLite %APPDATA%\ankyra-pos\ankyra.db (esquema/migraciones/mapeo/seed), Datos: base de datos en %APPDATA%/ankyra-pos/ankyra.db

### Community 31 - "Distribucion (electron-builder)"
Cohesion: 0.40
Nodes (6): Distribución: ZIP portable, NSIS abandonado (Defender/UAC/SmartScreen), asarUnpack: resources/** y *.node (módulo nativo better-sqlite3), electron-builder.yml — configuración de build de Ankyra, Config NSIS: oneClick, perMachine false, allowElevation false (instala en LOCALAPPDATA), output: C:/ankyra-build/dist (fuera de OneDrive para evitar EPERM), Decisión: distribución ZIP portable (remite a CLAUDE.md)

### Community 32 - "Branding Ankyra/Olyssea"
Cohesion: 0.40
Nodes (6): Ankyra brand (rebrand from Hermes), --color-acento design token (#0f4c5c, teal oscuro), Olyssea (parent company / studio), Ankyra Logo (wordmark), Ankyra Logo ("Powered by Olyssea"), Hermes Logo (legacy brandmark, black abstract wing/mark silhouette)

### Community 33 - "Pantalla de Clientes"
Cohesion: 0.40
Nodes (3): Clientes(), estadoSaldo(), METODOS

### Community 34 - "Preload API Bridge"
Cohesion: 0.60
Nodes (3): Api, Window, invoke

### Community 35 - "Componente Icono"
Cohesion: 0.40
Nodes (3): NombreIcono, paths, Props

### Community 38 - "Pantalla de Usuarios"
Cohesion: 0.50
Nodes (3): ETIQUETA_ROL, limpiar(), Usuarios()

### Community 39 - "Estructura de Carpetas (docs)"
Cohesion: 0.50
Nodes (4): src/renderer/src/pages — pantallas de la app, src/main/repos — acceso a datos por dominio, Propinas fuera de 'ventas' (2026-07-08): SUM(pagos.monto) − propina, Estructura de carpetas: main/db, main/repos, main/ipc, main/printer, preload, renderer, shared

### Community 41 - "Ticket de Cocina"
Cohesion: 0.67
Nodes (3): agruparPorComensal(), Props, TicketCocina()

### Community 44 - "Impresion ESC/POS (docs)"
Cohesion: 0.67
Nodes (3): src/main/printer — impresión térmica ESC/POS (tickets.ts, serial.ts), Decisión: marca = Ankyra (antes Hermes), Ticket final (printer/tickets.ts + preview TicketFinal.tsx)

## Ambiguous Edges - Review These
- `Distribución: ZIP portable, NSIS abandonado (Defender/UAC/SmartScreen)` → `Config NSIS: oneClick, perMachine false, allowElevation false (instala en LOCALAPPDATA)`  [AMBIGUOUS]
  electron-builder.yml · relation: conceptually_related_to

## Knowledge Gaps
- **243 isolated node(s):** `name`, `version`, `description`, `main`, `author` (+238 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Distribución: ZIP portable, NSIS abandonado (Defender/UAC/SmartScreen)` and `Config NSIS: oneClick, perMachine false, allowElevation false (instala en LOCALAPPDATA)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `fechaHora()` connect `Decisiones de Producto (ESTADO.md)` to `Utilidades de Ticket`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `DetalleOrden` connect `Utilidades de Ticket` to `Respaldos y Corte de Caja`, `Decisiones de Producto (ESTADO.md)`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `obtenerDb()` connect `Mapeo DB a Objetos` to `Tipos Compartidos (types.ts)`, `Pantalla de Ajustes`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _243 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mapeo DB a Objetos` be split into smaller, more focused modules?**
  _Cohesion score 0.05818395533352924 - nodes in this community are weakly interconnected._
- **Should `Respaldos y Corte de Caja` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._