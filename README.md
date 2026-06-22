# Hermes POS

Punto de venta de escritorio para taquerías y negocios con mesas. Hecho para la agencia **Olyssea**.

## Stack

- **Electron** + **electron-vite**
- **React** + **TypeScript** + **Tailwind CSS**
- **SQLite** (better-sqlite3) — base de datos local
- Impresión térmica ESC/POS (en desarrollo; hoy en modo simulación)

## Requisitos

- Node.js 20+ (probado con Node 22)
- Windows (objetivo principal). En la primera instalación se recompila el módulo
  nativo `better-sqlite3` para Electron automáticamente (`postinstall`).

## Cómo correr

```bash
npm install      # instala dependencias y recompila better-sqlite3 para Electron
npm run dev      # abre la app en modo desarrollo (hot reload)
```

Otros scripts:

```bash
npm run build       # compila main + preload + renderer
npm run typecheck   # verifica tipos (node y web)
npm run rebuild     # recompila better-sqlite3 si hiciera falta
```

## Estructura

```
src/
  main/        Proceso principal de Electron
    db/        Conexión SQLite, esquema, migraciones, seed, mapeo
    repos/     Acceso a datos (mesas, catálogo, órdenes, cortes, reimpresiones)
    ipc/       Handlers IPC
    printer/   Tickets (cocina / final) — modo simulación
  preload/     API segura expuesta al renderer (window.api)
  renderer/    Interfaz React
    pages/     Mesas, Pedidos, Cobro, Corte, Catálogo
    components/ Componentes reutilizables
    store/     Estado de la app conectado a window.api
  shared/      Tipos y canales IPC compartidos
```

## Datos

La base de datos vive en la carpeta de datos de usuario del sistema
(`%APPDATA%/hermes-pos/hermes.db` en Windows). El esquema y los datos iniciales
se crean automáticamente al primer arranque.

## Módulos

- **Mesas**: cuadrícula con estados; nombres y capacidad editables; pedidos para llevar.
- **Pedidos**: catálogo por categorías, modificadores con grupos y reglas, notas, envío a cocina (ticket diferencial).
- **Cobro**: efectivo/tarjeta/transferencia, descuentos, cambio, ticket de cliente y reimpresiones.
- **Corte de caja**: totales del turno por método e historial.
- **Catálogo**: administración de productos, categorías y modificadores.
