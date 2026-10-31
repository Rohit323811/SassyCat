'use strict';
const { app, BrowserWindow, Menu, ipcMain, screen, session } = require('electron');
const path = require('node:path');

const IDLE_SIZE = { width: 300, height: 300 }; // SassyCat on her own
const CHAT_SIZE = { width: 400, height: 560 }; // window grows while the chat is open
const POLL_MS = 3000;

// `forward: true` (clicks pass through, mouse-move still reaches the page)
// only exists on Windows and macOS.
const CLICK_THROUGH = process.platform !== 'linux';

let win = null;
let pollTimer = null;
let polling = false;
let getActiveWindow = null;
let lastApp = null;

/* ---------- Window ---------- */

// Bottom-right corner of the primary display's work area (above the taskbar/dock).
function cornerBounds({ width, height }) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - width, y: wa.y + wa.height - height, width, height };
}

function createWindow() {
  win = new BrowserWindow({
    ...cornerBounds(IDLE_SIZE),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  // Transparent space never blocks your mouse. The page tells us when the
  // pointer is over the cat or the chat panel (see 'set-interactive' below).
  if (CLICK_THROUGH) win.setIgnoreMouseEvents(true, { forward: true });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.once('did-finish-load', () => {
    pollActiveApp();
    pollTimer = setInterval(pollActiveApp, POLL_MS);
  });
  win.on('closed', () => {
    clearInterval(pollTimer);
    win = null;
  });
}

/* ---------- Active app tracking ----------
   Reads ONE thing: the name of the app that is in front (owner.name).
   No window titles (they can contain document names, URLs, chat names),
   no screenshots, no keystrokes. The name is lower-cased, trimmed, sent to
   the page, and never written to disk. */

async function loadTracker() {
  try {
    const mod = await import('active-win'); // ESM-only package, so dynamic import
    getActiveWindow = mod.activeWindow ?? mod.default;
  } catch (err) {
    console.warn('[tracker] active-win unavailable, mood tracking is off:', err.message);
  }
}

function cleanName(raw) {
  return String(raw ?? '').toLowerCase().replace(/\.exe$/, '').trim().slice(0, 64);
}

async function pollActiveApp() {
  if (polling || !getActiveWindow || !win || win.isDestroyed()) return;
  polling = true;
  try {
    // These two options stop macOS from asking for Accessibility / Screen Recording
    // permission. The side effect is that `title` is always empty, which is what we want.
    const info = await getActiveWindow({
      accessibilityPermission: false,
      screenRecordingPermission: false,
    });
    if (!info) return;

    const name = cleanName(info.owner && info.owner.name);
    // If the front window is SassyCat itself (you just clicked her), keep the last mood.
    if (info.owner && info.owner.processId === process.pid) return;
    if (!name || name === 'electron' || name === app.getName().toLowerCase()) return;

    if (name !== lastApp) {
      lastApp = name;
      console.log('[tracker] active app:', name); // terminal only, for testing
    }
    win.webContents.send('active-app', name);
  } catch (err) {
    console.warn('[tracker] check failed:', err.message);
  } finally {
    polling = false;
  }
}

/* ---------- IPC (every handler checks who is asking) ---------- */

const fromPet = (event) => Boolean(win) && !win.isDestroyed() && event.sender === win.webContents;

ipcMain.on('set-interactive', (event, interactive) => {
  if (!fromPet(event) || typeof interactive !== 'boolean' || !CLICK_THROUGH) return;
  if (interactive) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

// Grow/shrink the window from the same bottom-right corner so the cat never moves.
ipcMain.on('set-chat-open', (event, open) => {
  if (!fromPet(event) || typeof open !== 'boolean') return;
  win.setBounds(cornerBounds(open ? CHAT_SIZE : IDLE_SIZE));
  if (open) win.focus(); // so the input box can take typing
});

ipcMain.on('show-menu', (event) => {
  if (!fromPet(event)) return;
  Menu.buildFromTemplate([
    {
      label: 'Toggle DevTools',
      click: () => {
        const wc = win.webContents;
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: 'detach' });
      },
    },
    { type: 'separator' },
    { label: 'Quit SassyCat', role: 'quit' },
  ]).popup({ window: win });
});

/* ---------- App lifecycle ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit(); // one cat is plenty
} else {
  app.whenReady().then(async () => {
    if (app.dock) app.dock.hide();
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await loadTracker();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
