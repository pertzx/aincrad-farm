const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ProxyManager = require('./farm/proxy-manager');
const FarmEngine = require('./farm/engine');
const ConfigStore = require('./farm/config-store');

let mainWindow = null;
let farmEngine = null;
let configStore = null;
let proxyManager = null;

const CONFIG_PATH = path.join(__dirname, 'config', 'farm-config.json');

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, height: 800, minWidth: 1000, minHeight: 650,
        title: 'Aincrad Farm — RORAX Edition',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false
        },
        show: false, backgroundColor: '#0c0c14'
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.send('config-loaded', configStore.getAll());
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (farmEngine) farmEngine.stopAll();
    });
}

app.whenReady().then(() => {
    configStore = new ConfigStore(CONFIG_PATH);
    proxyManager = new ProxyManager(configStore.get('proxyTimeout', 8000));
    farmEngine = new FarmEngine(configStore, proxyManager);

    ipcMain.handle('farm:start', async (event, cfg) => {
        try { configStore.merge(cfg); return await farmEngine.start(cfg); }
        catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('farm:stop', async () => {
        try { return await farmEngine.stopAll(); }
        catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('farm:status', async () => {
        try { return farmEngine.getStatus(); }
        catch (e) { return { running: false, instances: [], stats: {}, logs: [] }; }
    });
    ipcMain.handle('proxy:refresh', async () => {
        // Agora o scanner roda sozinho, mas permite refresh manual
        try {
            const list = proxyManager.getProxies();
            return list;
        } catch (e) { return []; }
    });
    ipcMain.handle('proxy:list', async () => {
        return proxyManager.getProxies();
    });
    ipcMain.handle('config:save', async (event, cfg) => {
        try { configStore.merge(cfg); return true; }
        catch (e) { return false; }
    });
    ipcMain.handle('config:load', async () => {
        return configStore.getAll();
    });
    ipcMain.handle('log:clear', async () => {
        try { farmEngine.clearLogs(); return true; }
        catch (e) { return false; }
    });

    createMainWindow();
});

app.on('window-all-closed', () => {
    if (farmEngine) farmEngine.stopAll();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});