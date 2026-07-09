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
- **Corte de caja**: apertura con fondo, cuadre, gastos + retiros desglosados, devolución
  de ventas, cambio de método, historial e impresión del corte.
- **Historial de tickets por mesa** (`HistorialMesa` → `TicketsRecientes`) accesible
  dentro de Pedidos; "Últimos tickets" en tiendita.
- **Colores por producto**; inventario (insumos + productos); créditos/fiados.
- **Ajustes** seccionado en pestañas (negocio, ticket, impresoras, respaldos).
- **Banners de impresora** conectada/desconectada rediseñados (App.tsx).
- **Adaptación a monitores chicos** (main.css): el UI es casi todo rem, así que se
  baja el `font-size` base (18px) por breakpoints de ancho (17/15.5/14.5/13.5px a
  ≤1536/1366/1200/1024) y todo encoge proporcional. La cuadrícula de productos
  (`CuadriculaVirtual`, px) reacomoda columnas sola por ResizeObserver.

## Pendientes / ideas abiertas
- (ninguno crítico ahora mismo — anotar aquí lo que surja)
- Futuro: migración a **web**.

## Notas de operación para retomar
- **Para retomar barato tras `/clear`:** correr el comando `/retomar` (definido en
  `.claude/commands/retomar.md`), que lee CLAUDE.md + ESTADO.md y se pone al día sin
  gastar el límite en `/compact`. Flujo: `/clear` → `/retomar`.
- Reiniciar dev tras tocar main/preload/shared; typecheck antes de cerrar.
- Para verificar cambios de main que "no aparecen": el dev suele estar viejo → reiniciar.
