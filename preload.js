const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Farm
    startFarm: (config) => ipcRenderer.invoke('farm:start', config),
    stopFarm: () => ipcRenderer.invoke('farm:stop'),
    getStatus: () => ipcRenderer.invoke('farm:status'),
    
    // Proxies
    refreshProxies: () => ipcRenderer.invoke('proxy:refresh'),
    listProxies: () => ipcRenderer.invoke('proxy:list'),
    testProxyTrace: (proxy) => ipcRenderer.invoke('proxy:test-trace', proxy),
    healthCheckProxies: () => ipcRenderer.invoke('proxy:health-check'),
    
    // Config
    saveConfig: (config) => ipcRenderer.invoke('config:save', config),
    loadConfig: () => ipcRenderer.invoke('config:load'),
    
    // Profiles
    saveProfile: (name, cfg) => ipcRenderer.invoke('profile:save', name, cfg),
    loadProfile: (name) => ipcRenderer.invoke('profile:load', name),
    listProfiles: () => ipcRenderer.invoke('profile:list'),
    deleteProfile: (name) => ipcRenderer.invoke('profile:delete', name),
    
    // Analytics
    getAnalytics: () => ipcRenderer.invoke('analytics:get'),
    recordSuccess: (link) => ipcRenderer.invoke('analytics:record-success', link),
    recordFail: (link) => ipcRenderer.invoke('analytics:record-fail', link),
    setEarnings: (val) => ipcRenderer.invoke('analytics:set-earnings', val),
    setGoal: (goal) => ipcRenderer.invoke('analytics:set-goal', goal),
    
    // Webhook
    testWebhook: (cfg) => ipcRenderer.invoke('webhook:test', cfg),
    
    // Logs
    clearLogs: () => ipcRenderer.invoke('log:clear'),
    
    // Events
    onLog: (callback) => ipcRenderer.on('farm:log', (_, data) => callback(data)),
    onStatusUpdate: (callback) => ipcRenderer.on('farm:status-update', (_, data) => callback(data)),
    onConfigLoaded: (callback) => ipcRenderer.on('config-loaded', (_, data) => callback(data)),
    onProxyUpdated: (callback) => ipcRenderer.on('proxy:updated', (_, data) => callback(data)),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});