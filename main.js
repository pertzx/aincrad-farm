
const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

const ProxyManager = require('./farm/proxy-manager');
const FarmEngine = require('./farm/engine');
const ConfigStore = require('./farm/config-store');

let mainWindow = null;
let tray = null;
let farmEngine = null;
let configStore = null;
let proxyManager = null;

const CONFIG_PATH = path.join(app.getPath('userData'), 'gs-farm-config.json');

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 850, minWidth: 1100, minHeight: 700,
        title: 'GS Farm — RORAX Edition v2.0',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false
        },
        show: false, backgroundColor: '#0c0c14',
        icon: path.join(__dirname, 'renderer', 'icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.send('config-loaded', configStore.getAll());
    });

    mainWindow.on('close', (e) => {
        if (configStore.get('stealthMode', false) && farmEngine && farmEngine.running) {
            e.preventDefault();
            mainWindow.hide();
        } else {
            if (farmEngine) farmEngine.stopAll();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (farmEngine) farmEngine.stopAll();
    });
}

function createTray() {
    // Cria ícone simples em memória se não existir arquivo
    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'icon.png'));
    } catch {
        trayIcon = nativeImage.createEmpty();
    }
    
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
    tray.setToolTip('GS Farm');
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir Dashboard', click: () => { if (mainWindow) mainWindow.show(); } },
        { type: 'separator' },
        { label: 'Iniciar Farm', click: async () => {
            if (mainWindow) {
                const cfg = configStore.getAll();
                await farmEngine.start(cfg);
            }
        }},
        { label: 'Parar Farm', click: async () => {
            if (farmEngine) await farmEngine.stopAll();
        }},
        { type: 'separator' },
        { label: 'Sair', click: () => {
            if (farmEngine) farmEngine.stopAll();
            app.quit();
        }}
    ]);
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) mainWindow.hide();
            else mainWindow.show();
        }
    });
}

app.whenReady().then(() => {
    configStore = new ConfigStore(CONFIG_PATH);
    proxyManager = new ProxyManager(configStore.get('proxyTimeout', 8000));
    farmEngine = new FarmEngine(configStore, proxyManager);

    // ===== FARM =====
    ipcMain.handle('farm:start', async (event, cfg) => {
        try { 
            configStore.merge(cfg); 
            return await farmEngine.start(cfg); 
        }
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

    // ===== PROXIES =====
    ipcMain.handle('proxy:refresh', async () => {
        try { return proxyManager.getProxies(); }
        catch (e) { return []; }
    });
    ipcMain.handle('proxy:list', async () => proxyManager.getProxies());
    ipcMain.handle('proxy:test-trace', async (event, proxy) => {
        const testWin = new BrowserWindow({
            width: 900, height: 600,
            title: `Rastreando: ${proxy.ip}:${proxy.port}`,
            webPreferences: { session: session.fromPartition(`trace-${Date.now()}`) }
        });
        const sess = testWin.webContents.session;
        if (proxy) {
            const pr = proxy.protocol === 'socks5'
                ? `socks5://${proxy.ip}:${proxy.port}`
                : `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
            await sess.setProxy({ proxyRules: pr });
        }
        await testWin.loadURL('https://www.geolocation.com/pt/');
        return { ok: true };
    });
    ipcMain.handle('proxy:health-check', async () => {
        return proxyManager.healthCheckAll();
    });

    // ===== CONFIG =====
    ipcMain.handle('config:save', async (event, cfg) => {
        try { configStore.merge(cfg); return true; }
        catch (e) { return false; }
    });
    ipcMain.handle('config:load', async () => configStore.getAll());
    
    // Perfis/Campanhas
    ipcMain.handle('profile:save', async (event, name, cfg) => {
        const profiles = configStore.get('profiles', {});
        profiles[name] = { ...cfg, savedAt: new Date().toISOString() };
        configStore.set('profiles', profiles);
        return true;
    });
    ipcMain.handle('profile:load', async (event, name) => {
        const profiles = configStore.get('profiles', {});
        return profiles[name] || null;
    });
    ipcMain.handle('profile:list', async () => {
        return configStore.get('profiles', {});
    });
    ipcMain.handle('profile:delete', async (event, name) => {
        const profiles = configStore.get('profiles', {});
        delete profiles[name];
        configStore.set('profiles', profiles);
        return true;
    });

    // ===== ANALYTICS =====
    ipcMain.handle('analytics:get', async () => {
        return {
            linkStats: configStore.get('linkStats', {}),
            dailyStats: configStore.get('dailyStats', {}),
            totalSuccess: configStore.get('totalSuccess', 0),
            totalFail: configStore.get('totalFail', 0),
            earningsPerBypass: configStore.get('earningsPerBypass', 0.05),
            dailyGoal: configStore.get('dailyGoal', { enabled: false, amount: 50, currency: 'BRL' })
        };
    });
    ipcMain.handle('analytics:record-success', async (event, link) => {
        const today = new Date().toISOString().split('T')[0];
        const stats = configStore.get('linkStats', {});
        if (!stats[link]) stats[link] = { success: 0, fail: 0, lastSuccess: null };
        stats[link].success++;
        stats[link].lastSuccess = new Date().toISOString();
        configStore.set('linkStats', stats);
        
        const daily = configStore.get('dailyStats', {});
        if (!daily[today]) daily[today] = { success: 0, fail: 0 };
        daily[today].success++;
        configStore.set('dailyStats', daily);
        
        configStore.set('totalSuccess', (configStore.get('totalSuccess', 0) + 1));
        return true;
    });
    ipcMain.handle('analytics:record-fail', async (event, link) => {
        const today = new Date().toISOString().split('T')[0];
        const stats = configStore.get('linkStats', {});
        if (!stats[link]) stats[link] = { success: 0, fail: 0, lastSuccess: null };
        stats[link].fail++;
        configStore.set('linkStats', stats);
        
        const daily = configStore.get('dailyStats', {});
        if (!daily[today]) daily[today] = { success: 0, fail: 0 };
        daily[today].fail++;
        configStore.set('dailyStats', daily);
        
        configStore.set('totalFail', (configStore.get('totalFail', 0) + 1));
        return true;
    });
    ipcMain.handle('analytics:set-earnings', async (event, val) => {
        configStore.set('earningsPerBypass', val);
        return true;
    });
    ipcMain.handle('analytics:set-goal', async (event, goal) => {
        configStore.set('dailyGoal', goal);
        return true;
    });

    // ===== LOGS =====
    ipcMain.handle('log:clear', async () => {
        try { farmEngine.clearLogs(); return true; }
        catch (e) { return false; }
    });

    // ===== WEBHOOK =====
    ipcMain.handle('webhook:test', async (event, cfg) => {
        try {
            const result = await sendWebhook(cfg, '🔔 **Teste de Webhook**\nConexão estabelecida com sucesso!');
            return { ok: result };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    createMainWindow();
    createTray();
});

async function sendWebhook(cfg, message) {
    if (!cfg || !cfg.enabled) return false;
    try {
        const fetch = (await import('node-fetch')).default;
        if (cfg.type === 'discord' && cfg.url) {
            await fetch(cfg.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: message })
            });
            return true;
        }
        if (cfg.type === 'telegram' && cfg.botToken && cfg.chatId) {
            await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: cfg.chatId, text: message, parse_mode: 'Markdown' })
            });
            return true;
        }
    } catch (e) { console.error('[Webhook] Erro:', e.message); }
    return false;
}

app.on('window-all-closed', () => {
    if (farmEngine) farmEngine.stopAll();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
