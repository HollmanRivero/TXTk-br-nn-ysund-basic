// TXTK.ZIP — main process
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const https = require('https');

const isDev = process.argv.includes('--dev');

// --- Brønnøysund API helper -------------------------------------------------
const BRREG_HOST = 'data.brreg.no';
const BRREG_BASE = '/enhetsregisteret/api';

function brregFetch(pathSuffix) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BRREG_HOST,
      path: BRREG_BASE + pathSuffix,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TXTK.ZIP/1.0 (Electron desktop client)'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 404) {
          return resolve({ ok: false, status: 404, error: 'Ikke funnet' });
        }
        if (res.statusCode >= 400) {
          return resolve({
            ok: false,
            status: res.statusCode,
            error: `HTTP ${res.statusCode}`
          });
        }
        try {
          resolve({ ok: true, status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, error: 'Ugyldig JSON' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, status: 0, error: err.message });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'Tidsavbrudd' });
    });

    req.end();
  });
}

// --- IPC --------------------------------------------------------------------
ipcMain.handle('brreg:search', async (_evt, { query, size = 20, page = 0 }) => {
  if (!query || !query.trim()) return { ok: false, error: 'Tomt søk' };
  const q = encodeURIComponent(query.trim());
  return brregFetch(`/enheter?navn=${q}&size=${size}&page=${page}`);
});

ipcMain.handle('brreg:lookup', async (_evt, orgnr) => {
  const clean = String(orgnr || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(clean)) {
    return { ok: false, error: 'Organisasjonsnummer må være 9 siffer' };
  }
  return brregFetch(`/enheter/${clean}`);
});

ipcMain.handle('brreg:roles', async (_evt, orgnr) => {
  const clean = String(orgnr || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(clean)) {
    return { ok: false, error: 'Organisasjonsnummer må være 9 siffer' };
  }
  return brregFetch(`/enheter/${clean}/roller`);
});

ipcMain.handle('brreg:subunits', async (_evt, orgnr) => {
  const clean = String(orgnr || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(clean)) {
    return { ok: false, error: 'Organisasjonsnummer må være 9 siffer' };
  }
  return brregFetch(`/underenheter?overordnetEnhet=${clean}&size=50`);
});

ipcMain.handle('shell:open-external', async (_evt, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

// --- Window -----------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#0c0c0c',
    title: 'TXTK.ZIP',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  // Prevent navigation away from app
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
