import { BrowserWindow, ipcMain } from 'electron'
import { CANALES } from '@shared/canales'
import type { DispositivoBluetooth } from '@shared/types'

// Plomería de Web Bluetooth en Electron. El renderer llama a
// `navigator.bluetooth.requestDevice()`; como Electron no trae selector propio,
// dispara el evento 'select-bluetooth-device' con la lista de dispositivos. Aquí
// reenviamos esa lista al renderer (que muestra su propio selector) y devolvemos
// la elección del usuario por el callback de Electron.

let callbackPendiente: ((deviceId: string) => void) | null = null
let ipcRegistrado = false

export function configurarBluetooth(win: BrowserWindow): void {
  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault()
    callbackPendiente = callback
    const lista: DispositivoBluetooth[] = deviceList.map((d) => ({
      id: d.deviceId,
      nombre: d.deviceName || 'Dispositivo sin nombre'
    }))
    if (!win.isDestroyed()) win.webContents.send(CANALES.ble.dispositivos, lista)
  })

  // Permite el uso de Bluetooth a esta ventana sin diálogos extra del sistema.
  win.webContents.session.setPermissionCheckHandler(() => true)

  // El renderer informa la elección del usuario ('' = canceló). Se registra una
  // sola vez aunque la ventana se recree.
  if (!ipcRegistrado) {
    ipcRegistrado = true
    ipcMain.on(CANALES.ble.seleccionar, (_e, deviceId: string) => {
      if (callbackPendiente) {
        callbackPendiente(deviceId)
        callbackPendiente = null
      }
    })
  }
}
