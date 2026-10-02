'use strict';

/**
 * Electron shell untuk Toolkit App (edisi publik).
 * Menjalankan server Express lokal dan membuka jendela app.
 */

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { createServer } = require('./server');

const configPath = path.join(__dirname, 'server', 'config', 'config.json');
let config = { server: { port: 5217, host: '127.0.0.1' } };
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.warn('[main] config.json tidak terbaca, pakai default port 5217');
}

const PORT = Number(config.server?.port) || 5217;
const HOST = config.server?.host || '127.0.0.1';
const dataDir = path.join(app.getPath('userData'), 'data');

let mainWindow = null;
let httpServer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Toolkit App',
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://${HOST}:${PORT}/app.html`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function start() {
  fs.mkdirSync(dataDir, { recursive: true });
  const expressApp = createServer({ dataDir });
  await new Promise((resolve, reject) => {
    httpServer = expressApp.listen(PORT, HOST, (err) => (err ? reject(err) : resolve()));
  });
  console.log(`[main] Server http://${HOST}:${PORT}`);
  console.log(`[main] Data dir: ${dataDir}`);
  createWindow();
}

app.whenReady().then(start).catch((err) => {
  console.error('[main] Gagal start:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  if (httpServer) {
    try { httpServer.close(); } catch (e) { /* */ }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
