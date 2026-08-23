const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startFarm: (config) => ipcRenderer.invoke('farm:start', config),
    stopFarm: () => ipcRenderer.invoke('farm:stop'),
    getStatus: () => ipcRenderer.invoke('farm:status'),
    refreshProxies: () => ipcRenderer.invoke('proxy:refresh'),
    listProxies: () => ipcRenderer.invoke('proxy:list'),
    saveConfig: (config) => ipcRenderer.invoke('config:save', config),
    loadConfig: () => ipcRenderer.invoke('config:load'),
    clearLogs: () => ipcRenderer.invoke('log:clear'),
    onLog: (callback) => ipcRenderer.on('farm:log', (_, data) => callback(data)),
    onStatusUpdate: (callback) => ipcRenderer.on('farm:status-update', (_, data) => callback(data)),
    onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', (_, data) => callback(data)),
    onProxyUpdated: (callback) => ipcRenderer.on('proxy:updated', (_, data) => callback(data)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
