# Estado del proyecto — Ankyra POS

> Documento vivo. Sirve para retomar el trabajo tras `/clear` o sesión nueva sin
> depender de `/compact`. **Al terminar una tanda de trabajo, actualizar este archivo.**
> Última actualización: 2026-07-08.

## Qué es
POS de escritorio para dos modos de operación:
- **Restaurante** (mesas, comandas a cocina, cobro por mesa).
- **Tiendita** (`modoTiendita` en config de impresoras): venta rápida tipo tienda,
  "Venta #N" en lugar de "Para llevar", sin selección de método al cobrar, sin
  reimprimir cocina.

## Decisiones ya tomadas (no volver a discutir)
- **Marca = Ankyra** (antes Hermes). Logo definido en Login y al pie del ticket
  (`ankyra-pie.png`, ya trae "Powered by Olyssea").
- **Distribución = ZIP portable**, no instalador (Defender bloqueaba NSIS). Ver CLAUDE.md.
- **Facturación = comprobante/nota de venta NO fiscal** (el usuario descartó CFDI real,
  que requiere PAC). Componente `NotaVentaDialog` captura razón social + RFC; el ticket
  lleva la leyenda "ESTE NO ES UN COMPROBANTE FISCAL".
- **Redondeo de efectivo** (2026-07-09): ajuste en Ajustes → Ticket → "Cobro en efectivo"
  (`redondeoEfectivo`: 0 / 0.5 / 1). Solo aplica cuando el método es **efectivo**; ajusta
  el total al múltiplo (evita centavos). En Cobro el "Total a cobrar", el cambio, "Exacto"
  y el pago usan el monto redondeado; muestra el hint "redondeo ±$x · exacto $y". El ticket
  (preview y impreso) muestra una línea **Redondeo** y el TOTAL redondeado, calculando la
  diferencia desde `pagos − (total+propina)` (sin migración). El cuadre queda correcto
  porque el efectivo del cajón = monto redondeado.
- **Caja con flujo estricto** (2026-07-08): hay que **abrir la caja** (con su fondo)
  para poder cobrar; el panel de pago en Cobro se bloquea con la caja cerrada y ofrece
  "Abrir caja" ahí mismo. "Cerrar turno" queda deshabilitado si la caja está cerrada.
  Flujo: abrir caja → cobrar → cerrar turno (que cierra la caja). El panel de pago
  muestra un "Total a cobrar" grande arriba.
- **Cobro en modo restaurante**: NO se pide método de pago (no se sabe con qué pagará
  antes de entregar); se asume efectivo y luego se corrige el método desde el Corte
  (`cambiarMetodoPago`).
- **Categoría "Todos"**: seed crea una por defecto; no se permite crear productos si no
  hay categorías. En modo tiendita se filtra la "Todos" real para no duplicar con la
  pestaña virtual "Todos".
- **Retiros de efectivo** (`gastos.tipo = 'retiro'` vs `'gasto'`): el retiro **baja el
  efectivo del cajón pero NO el balance/utilidad** (es dinero que salió, no un gasto).
  El corte esperado resta gastos + retiros; el balance resta solo gastos.
- **Propinas fuera de "ventas"** (implementado 2026-07-08, ver abajo).
- **Teclado virtual opcional** (config); al cerrarlo mantiene el foco en el input.
- **Cantidad editable** en pedidos/tienda (`CantidadEditable`): escribir "100" en vez de
  picar +100 veces.

## Último cambio aplicado: propinas fuera de ventas (2026-07-08)
Motivo: el pago del cliente = venta + propina (`neto = imp.total + propina` en Cobro.tsx),
y `SUM(pagos.monto)` incluía la propina, inflando "ventas".
- `src/main/repos/reportes.ts`: `ventas` y `porDia` = `SUM(pagos.monto) − propina`,
  con los pagos **pre-agregados por orden** (subconsulta `pagosPorOrden`) para restar la
  propina una sola vez por venta aunque el pago sea mixto. Utilidad ya era libre de
  propina (sale del detalle). Donut por método se dejó como está (dinero recibido real).
- `src/renderer/src/pages/Corte.tsx`: tarjeta **Ventas** y **Balance** = totales −
  propinas; historial de cortes usa la misma fórmula; el **cuadre de caja** y las
  tarjetas Efectivo/Tarjeta/Transferencia se mantienen con el dinero completo (el cajón
  físicamente tiene la propina). Nota al usuario: Efectivo+Tarjeta+Transferencia queda
  arriba de "Ventas"; la diferencia son las propinas (se listan aparte).
- Verificado: `npm run typecheck` OK; dev reiniciado.

## Otras funciones ya construidas
- **Ticket final** (`printer/tickets.ts` + preview `TicketFinal.tsx`): logo negocio,
  identidad, mensaje, leyenda no fiscal, productos SIN "x" entre cantidad y nombre,
  modificadores con precio aparte solo si `precio > 0`, "Son … " centrado, TOTAL grande,
  pagos, logo Ankyra al pie (ambos logos 25% más chicos). Redes sociales se quitaron.
- **Reportes**: dashboard rediseñado (hero Ventas/Utilidad con margen, KPIs incl.
  Propinas, gráfica de barras por día, donut por método, top productos con medallas).
  Selector de rango de fechas custom `RangoFechas` (sin dependencias).
- **Finanzas fusionado en Corte de caja** (2026-07-09): se eliminó la pantalla Finanzas
  (era redundante). El **alta y borrado de gastos/retiros** ahora vive en la sección
  "Gastos y retiros del turno" del Corte (formulario con tipo Gasto/Retiro + eliminar).
  La página Gastos (rol mesero) sigue existiendo aparte.
- **Corte de caja**: apertura con fondo, cuadre, gastos + retiros desglosados, devolución
  de ventas, cambio de método, historial e impresión del corte. Resumen del turno como
  **hoja de corte** (deliberadamente distinto a Reportes: sin degradado ni KPIs con
  ícono): tarjeta de Balance con tinte teal suave + Ventas/Órdenes, y un "Desglose del
  turno" tipo ledger con renglones punteados (Efectivo/Tarjeta/Transferencia/Propinas/
  Gastos/Retiros). Banners de caja (cerrada = neutro, sin amarillo) e impresora
  desconectada (blanco con badge rojo, botón teal) sin amarillo.
- **Historial de tickets por mesa** (`HistorialMesa` → `TicketsRecientes`) accesible
  dentro de Pedidos; "Últimos tickets" en tiendita.
- **Colores por producto**; inventario (insumos + productos); créditos/fiados.
- **Ajustes** seccionado en pestañas (negocio, ticket, impresoras, respaldos).
- **Banners de impresora** conectada/desconectada rediseñados (App.tsx).
- **Adaptación a monitores chicos** (main.css): el UI es casi todo rem, así que se
  baja el `font-size` base (18px) por breakpoints de ancho (17/15.5/14.5/13.5px a
  ≤1536/1366/1200/1024) y todo encoge proporcional. La cuadrícula de productos
  (`CuadriculaVirtual`, px) reacomoda columnas sola por ResizeObserver.
- **Estilo unificado tipo Reportes** en todas las pantallas: kit compartido
  `components/Pagina.tsx` (`EncabezadoPagina`, `Panel`, `EstadoVacio`). Encabezados
  consistentes (`text-2xl font-bold tracking-tight` + subtítulo), tarjetas/paneles
  `rounded-2xl border-black/[0.06] shadow-sm`, estados vacíos con ícono en pastilla.
  Aplicado a Gastos, Finanzas, Clientes, Catálogo, Usuarios, Inventario, Mesas, Cobro,
  Tienda, Pedidos, Ajustes.
- **Sistema de botones estandarizado** (clases en `main.css @layer components`):
  `.btn-primario`/`.btn-neutro`/`.btn-peligro`/`.btn-texto` (rounded-lg, transición,
  `active:scale`). Todos los botones migrados. Para uno nuevo, usar la clase.
- **Dropdown propio** `components/Select.tsx` (reemplaza el `<select>` nativo, que en
  Windows ignora el estilo de sus `<option>`): lista en portal con posición fija
  (no se corta en modales/tablas), volteo arriba/abajo, cierre por scroll/clic-fuera/Esc,
  teclado (flechas/Enter/Esc), opciones con tema teal (hover y seleccionado). Los 9
  selects de la app (Catálogo, Ajustes, Cobro, Corte, Usuarios) usan `<Select>`.
  `size="sm"` para celdas compactas, `invalido` para requerido sin elegir.
- **Segmented control deslizante** `Pestanas` (en `components/Pagina.tsx`): pastilla
  blanca que se mueve suave (translateX por índice, pestañas de igual ancho). Usado en
  Catálogo (Productos/Categorías/Modificadores) y Ajustes (Negocio/Ticket/Impresoras/
  Respaldos). Filas de producto del Catálogo a 64px (más grandes, nombre 15px seminegrita).

## Pendientes / ideas abiertas
- **Promociones** (2x1/NxM, % por producto/categoría, precio por horario) — pendientes.
- Combos: falta **inventario de componentes** (descontar stock de las partes al vender el
  combo). La comanda muestra el combo como UNA línea (su nombre) con sus productos
  desglosados debajo como sub-ítems (`expandirCombos` en `lib/comandas.ts`;
  `listarProductos` incluye `comboItems`; se aplica en Pedidos `repartir` y en Cobro
  `reimprimirCocina`; el combo se rutea por su categoría).
- Futuro: migración a **web**.

## Combos (producto a precio fijo) — 2026-07-10  [MVP]
- DB: `productos.es_combo` (migración aditiva) + tabla `combo_items` (combo_id, producto_id,
  cantidad; la crea el esquema). Tipos: `Producto.esCombo` + `ComboItem` + `Producto.comboItems`.
- Repo `catalogo.guardarProducto` persiste `es_combo` y reemplaza `combo_items`;
  `catalogo.comboItems(comboId)` los lee (IPC `catalogo:comboItems`).
- UI: en el editor de producto (Catálogo) hay un toggle "Es un combo" + selector de
  productos incluidos (producto + cantidad). Badge "Combo" en la lista.
- Se vende como un producto normal a su precio fijo (una línea). Inventario de partes y
  comanda de cocina expandida = PENDIENTES (ver arriba).

Descuento por línea ahora acepta **% o $** (selector en `DescuentoLineaDialog`).

## Receta: insumos por producto (descarga automática) — 2026-07-10
Cada producto puede declarar **qué insumos gasta y en qué cantidad** por unidad; al
vender se descuenta el inventario de insumos solo.
- DB: tabla `producto_insumos (producto_id, insumo_id, cantidad REAL, PK(prod,insumo))`,
  la crea el esquema (como `combo_items`). Tipo `RecetaItem` + `Producto.receta`.
- Repo `catalogo.guardarProducto` reemplaza la receta (borra + reinserta); `catalogo.receta(id)`
  la lee (IPC `catalogo:receta`, preload, canal). Fluye por `ProductoInput` como comboItems.
- Descuento al vender: `ordenes.ajustarInsumosReceta(db, ordenId, factor)` — consumo por insumo
  = Σ(cantidad vendida × cantidad receta); factor −1 al cobrar/fiar, +1 al devolver. Registra
  `movimientos_inventario` ('salida'/'entrada'). Se llama junto a `ajustarStockProductos` en las
  3 rutas (cobrar/fiar/devolver). Independiente de `controlar_stock` del producto.
- UI: editor de producto (Catálogo) con sección "Insumos que consume (receta)" — selector de
  insumo + cantidad (decimales). Se carga al editar (`window.api.catalogo.receta`).
- **Select de unidades del insumo** (Inventario) cambiado de `<datalist>` (feo y no desplegaba
  en Electron) al componente `Select` propio.

## Código de barras / lector (scanner) — 2026-07-10
Los productos pueden tener **código de barras** y escanearse en la venta (modo tiendita).
- DB: columna `productos.codigo_barras` (TEXT, migración aditiva); `Producto.codigoBarras` +
  mapeo; `guardarProducto` lo persiste (INSERT/UPDATE). Import masivo también lo mapea
  (`FilaImportProducto.codigoBarras`, alias en `importar.ts`: codigo/barcode/sku/upc/ean/clave).
- Editor de producto (Catálogo): campo "Código de barras" (se puede escanear ahí mismo o
  teclear). Columna extra en el mapeo de importación Excel/CSV.
- Captura: hook `lib/escaner.ts` (`useEscaner`) escucha el lector USB (teclea rápido y da
  Enter): detecta la ráfaga (< 80 ms entre teclas, ≥ 3 chars) y entrega el código; el tecleo
  humano lento no lo dispara.
- **Escaneo GLOBAL** (en `App.tsx`, solo modo tiendita): estés en la pantalla que estés, al
  escanear se busca el producto activo por su código, se navega a **Venta** (`vista='tienda'`)
  y se agrega. Se **ignora si el foco está en un campo** (input/textarea/contenteditable), para
  no secuestrar la captura del código en el editor de Catálogo. Si no existe, toast. App le pasa
  a Tienda `{ producto, nonce }` (prop `escaneado`); Tienda lo agrega vía `tocarProducto` (abre
  el selector si tiene modificadores) con un `useRef` que evita re-procesar el mismo escaneo
  (incl. StrictMode). NO cableado en Pedidos (restaurante); mismo hook si se pide.

## Filtro por tipo en Catálogo — 2026-07-10
En Catálogo → Productos, segmentado deslizante **Todos · Productos · Combos** (reusa
`Pestanas`) que filtra la lista; el conteo se ajusta al filtro. Solo aparece si ya existe
algún combo (si no, no estorba). Estado vacío con mensaje según el filtro.

## Nota del ticket (nivel orden) — 2026-07-10
Texto libre que se captura en Cobro (sección colapsable "Nota del ticket") y se imprime
en el ticket del cliente. DB: `ordenes.nota` (migración aditiva); `Orden.nota` + mapeo;
repo `fijarNotaOrden` → IPC `ordenes:notaOrden` → store `cambiarNotaOrden`. Se guarda al
salir del campo y al cobrar. Se imprime bajo la fecha en TicketFinal (preview) y tickets.ts.

## Descuento por producto (línea) — 2026-07-10
Se puede descontar una sola línea del carrito sin afectar las demás.
- DB: columna `detalle_ordenes.descuento` (REAL, migración aditiva). `recalcularTotal`
  resta el descuento por línea (`MAX(cantidad*precio - descuento, 0)`), así `orden.total`
  ya viene neto.
- Repo `ordenes.fijarDescuentoLinea(detalleId, monto)` (acota al importe de la línea) →
  IPC `ordenes:descontarLinea` → preload → store `descontarLinea`.
- UI: componente `DescuentoLineaDialog` (montos/% + custom), botón de descuento por línea
  en **Tienda** y **Pedidos**; la línea muestra precio tachado + neto.
- Ticket (preview e impreso) y panel de Cobro muestran línea "Descuento −$x".
  `agruparLineas`/`LineaTicket` llevan `descuento`. Reportes: utilidad e importe de top
  productos restan el descuento por línea. (Aún NO pide PIN por línea; el descuento de
  orden en Cobro sí — se puede unificar si se quiere.)

## Notas de operación para retomar
- **Para retomar barato tras `/clear`:** correr el comando `/retomar` (definido en
  `.claude/commands/retomar.md`), que lee CLAUDE.md + ESTADO.md y se pone al día sin
  gastar el límite en `/compact`. Flujo: `/clear` → `/retomar`.
- Reiniciar dev tras tocar main/preload/shared; typecheck antes de cerrar.
- Para verificar cambios de main que "no aparecen": el dev suele estar viejo → reiniciar.
