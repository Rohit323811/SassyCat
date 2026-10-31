'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The page never sees ipcRenderer. It only gets these four narrow functions.
contextBridge.exposeInMainWorld('sassy', {
  // Receives the active app's name (a plain string) every few seconds.
  onActiveApp(callback) {
    const handler = (_event, name) => {
      if (name === null || typeof name === 'string') callback(name);
    };
    ipcRenderer.on('active-app', handler);
    return () => ipcRenderer.removeListener('active-app', handler);
  },
  setInteractive: (interactive) => ipcRenderer.send('set-interactive', Boolean(interactive)),
  setChatOpen: (open) => ipcRenderer.send('set-chat-open', Boolean(open)),
  showMenu: () => ipcRenderer.send('show-menu'),
});
