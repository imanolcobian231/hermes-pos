import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { inicializarDb, cerrarDb } from './db'
import { registrarIpc } from './ipc'
import { configurarBluetooth } from './bluetooth'
import { respaldoDiarioSiHaceFalta } from './db/respaldo'

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Hermes',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      // Sin DevTools en producción: evita que se salten los controles desde la
      // consola del renderer. En desarrollo siguen disponibles.
      devTools: isDev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Habilita el selector de impresoras Bluetooth (Web Bluetooth).
  configurarBluetooth(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // En desarrollo carga el servidor de Vite; en producción el HTML compilado.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Quita el menú de la aplicación en producción (oculta el atajo de DevTools y
  // demás acciones). En desarrollo se conserva para depurar.
  if (!isDev) Menu.setApplicationMenu(null)

  // Inicializa la base de datos (esquema + seed) y registra los handlers IPC.
  inicializarDb()
  registrarIpc()

  // Respaldo diario de la base de datos (no bloquea el arranque).
  void respaldoDiarioSiHaceFalta()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  cerrarDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
