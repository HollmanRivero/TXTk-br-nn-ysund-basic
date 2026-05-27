// TXTK.ZIP — preload (contextBridge: trygg API mellom renderer og main)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('txtk', {
  search: (query, opts = {}) => ipcRenderer.invoke('brreg:search', { query, ...opts }),
  lookup: (orgnr) => ipcRenderer.invoke('brreg:lookup', orgnr),
  roles: (orgnr) => ipcRenderer.invoke('brreg:roles', orgnr),
  subunits: (orgnr) => ipcRenderer.invoke('brreg:subunits', orgnr),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
});
