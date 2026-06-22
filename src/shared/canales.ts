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
    guardarGrupo: 'catalogo:guardarGrupo',
    eliminarGrupo: 'catalogo:eliminarGrupo',
    guardarModificador: 'catalogo:guardarModificador',
    eliminarModificador: 'catalogo:eliminarModificador'
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
    cancelar: 'ordenes:cancelar'
  },
  cortes: {
    resumen: 'cortes:resumen',
    listar: 'cortes:listar',
    cerrar: 'cortes:cerrar'
  },
  reimpresiones: {
    listar: 'reimpresiones:listar',
    registrar: 'reimpresiones:registrar'
  },
  printer: {
    cocina: 'printer:cocina',
    final: 'printer:final'
  }
} as const
