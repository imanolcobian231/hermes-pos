// Nombres de canales IPC, compartidos entre main (handlers) y preload (invoke).

export const CANALES = {
  mesas: {
    listar: 'mesas:listar',
    crear: 'mesas:crear',
    editar: 'mesas:editar',
    renombrar: 'mesas:renombrar',
    eliminar: 'mesas:eliminar'
  },
  catalogo: {
    categorias: 'catalogo:categorias',
    guardarCategoria: 'catalogo:guardarCategoria',
    eliminarCategoria: 'catalogo:eliminarCategoria',
    productos: 'catalogo:productos',
    guardarProducto: 'catalogo:guardarProducto',
    eliminarProducto: 'catalogo:eliminarProducto',
    grupos: 'catalogo:grupos',
    guardarGrupo: 'catalogo:guardarGrupo',
    eliminarGrupo: 'catalogo:eliminarGrupo',
    guardarModificador: 'catalogo:guardarModificador',
    eliminarModificador: 'catalogo:eliminarModificador',
    asignarGrupo: 'catalogo:asignarGrupo',
    desasignarGrupo: 'catalogo:desasignarGrupo'
  },
  ordenes: {
    activas: 'ordenes:activas',
    deMesa: 'ordenes:deMesa',
    abrir: 'ordenes:abrir',
    abrirLlevar: 'ordenes:abrirLlevar',
    descartar: 'ordenes:descartar',
    agregarProducto: 'ordenes:agregarProducto',
    cambiarCantidad: 'ordenes:cambiarCantidad',
    cambiarNota: 'ordenes:cambiarNota',
    quitarLinea: 'ordenes:quitarLinea',
    enviarCocina: 'ordenes:enviarCocina',
    marcarPorCobrar: 'ordenes:marcarPorCobrar',
    cobrar: 'ordenes:cobrar',
    fiar: 'ordenes:fiar',
    cancelar: 'ordenes:cancelar',
    devolver: 'ordenes:devolver',
    cobradasTurno: 'ordenes:cobradasTurno'
  },
  clientes: {
    listar: 'clientes:listar',
    guardar: 'clientes:guardar',
    eliminar: 'clientes:eliminar',
    movimientos: 'clientes:movimientos',
    abonar: 'clientes:abonar'
  },
  cortes: {
    resumen: 'cortes:resumen',
    listar: 'cortes:listar',
    cerrar: 'cortes:cerrar',
    estadoCaja: 'cortes:estadoCaja',
    abrirCaja: 'cortes:abrirCaja'
  },
  cancelaciones: {
    listar: 'cancelaciones:listar'
  },
  reportes: {
    generar: 'reportes:generar'
  },
  respaldo: {
    obtener: 'respaldo:obtener',
    guardar: 'respaldo:guardar',
    ahora: 'respaldo:ahora',
    listar: 'respaldo:listar',
    elegirCarpeta: 'respaldo:elegirCarpeta',
    abrirCarpeta: 'respaldo:abrirCarpeta',
    restaurar: 'respaldo:restaurar'
  },
  gastos: {
    listar: 'gastos:listar',
    crear: 'gastos:crear',
    eliminar: 'gastos:eliminar'
  },
  usuarios: {
    listar: 'usuarios:listar',
    hayUsuarios: 'usuarios:hayUsuarios',
    crearPrimerAdmin: 'usuarios:crearPrimerAdmin',
    login: 'usuarios:login',
    logout: 'usuarios:logout',
    guardar: 'usuarios:guardar',
    eliminar: 'usuarios:eliminar',
    verificarPinAdmin: 'usuarios:verificarPinAdmin'
  },
  reimpresiones: {
    listar: 'reimpresiones:listar',
    registrar: 'reimpresiones:registrar'
  },
  printer: {
    bytesCocina: 'printer:bytesCocina',
    bytesFinal: 'printer:bytesFinal',
    bytesPrueba: 'printer:bytesPrueba',
    listarPuertos: 'printer:listarPuertos',
    enviarCom: 'printer:enviarCom'
  },
  ble: {
    // Evento main → renderer con la lista de dispositivos detectados.
    dispositivos: 'ble:dispositivos',
    // Renderer → main: el usuario eligió un dispositivo (o canceló con '').
    seleccionar: 'ble:seleccionar'
  },
  config: {
    obtenerImpresoras: 'config:obtenerImpresoras',
    guardarImpresoras: 'config:guardarImpresoras'
  }
} as const
