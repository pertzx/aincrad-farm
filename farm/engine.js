const { BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { generateFingerprint, randomInt } = require('./fingerprint');
const Scheduler = require('./scheduler');

const BYPASS_SCRIPT = fs.readFileSync(path.join(__dirname, 'bypass-inject.js'), 'utf-8');

const SUPPORTED_ROOTS = [
    'alpharede.com','rodaemotor.com','guis2.com','horoscopeonday.com',
    'forumdinheiro.com','milbviral.com','tarviral.com','aincradmods.com'
];

function isSupportedHost(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        return SUPPORTED_ROOTS.some(r => host === r || host.endsWith('.' + r));
    } catch { return false; }
}

class FarmEngine {
    constructor(configStore, proxyManager) {
        this.configStore = configStore;
        this.proxyManager = proxyManager;
        this.instances = new Map();
        this.running = false;
        this.stats = { totalRuns: 0, successCount: 0, failCount: 0, startTime: null };
        this.logs = [];
    }

    log(instanceId, level, message) {
        const entry = { time: new Date().toLocaleTimeString('pt-BR'), instance: instanceId || 'MAIN', level, message };
        this.logs.unshift(entry);
        if (this.logs.length > 300) this.logs.pop();
        this._broadcast('farm:log', entry);
        console.log(`[${entry.instance}] ${message}`);
    }

    _broadcast(channel, data) {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send(channel, data);
        });
    }

    _broadcastStatus() {
        this._broadcast('farm:status-update', this.getStatus());
    }

    async start(config) {
        if (this.running) return { ok: false, error: 'Já está rodando' };
        this.running = true;
        this.stats.startTime = Date.now();
        const count = Math.min(Math.max(1, config.instances || 1), 10);
        this.log('MAIN', 'info', `Iniciando farm com ${count} instância(s)...`);

        // Inicia scanner de proxy em background (nunca bloqueia)
        if (config.useProxies !== false) {
            this.proxyManager.startScanner();
            const existing = this.proxyManager.getProxies();
            if (existing.length > 0) {
                this.log('MAIN', 'info', `${existing.length} proxies no cache`);
            } else {
                this.log('MAIN', 'warn', 'Nenhum proxy ainda — usando IP direto até carregar');
            }
            // Notifica UI das proxies existentes
            this._broadcast('proxy:updated', existing);
        }

        for (let i = 0; i < count; i++) {
            await this._spawnInstance(i, config);
            await this._sleep(randomInt(1000, 3000));
        }
        return { ok: true };
    }

    async _spawnInstance(id, config) {
        const fp = generateFingerprint();
        let proxy = null;
        if (config.useProxies !== false) {
            proxy = this.proxyManager.pickWeighted();
        }

        const partition = `persist:farm-${id}-${Date.now()}`;
        const sess = session.fromPartition(partition);

        if (proxy) {
            try {
                const proxyRules = proxy.protocol === 'socks5'
                    ? `socks5://${proxy.ip}:${proxy.port}`
                    : `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
                await sess.setProxy({ proxyRules });
                const loc = this._formatLocation(proxy);
                this.log(id, 'info', `Proxy: ${loc} — ${proxy.ping}ms (T${proxy.tier})`);
            } catch (e) {
                this.log(id, 'warn', `Proxy falhou: ${e.message}`);
                proxy = null;
            }
        } else if (config.useProxies !== false) {
            this.log(id, 'info', 'Sem proxy disponível — usando IP direto');
        }

        if (config.clearStorage !== false) {
            try { await sess.clearStorageData(); await sess.clearCache(); } catch (e) {}
        }

        const win = new BrowserWindow({
            width: fp.viewport.width, height: fp.viewport.height,
            show: config.headless === true ? false : true,
            webPreferences: {
                session: sess, nodeIntegration: false, contextIsolation: true,
                sandbox: true, allowRunningInsecureContent: false, webSecurity: true
            },
            title: `Farm #${id + 1}`, backgroundColor: '#0c0c14'
        });

        sess.webRequest.onBeforeSendHeaders((details, callback) => {
            const headers = { ...details.requestHeaders };
            headers['User-Agent'] = fp.userAgent;
            if (fp.referrer && config.spoofReferrer !== false) headers['Referer'] = fp.referrer;
            headers['Accept-Language'] = fp.language;
            callback({ requestHeaders: headers });
        });

        this.instances.set(id, {
            window: win, session: sess, fingerprint: fp, status: 'starting',
            cycle: 0, phase: null, currentLink: null, proxy: proxy,
            timeoutId: null, pollId: null
        });
        this._broadcastStatus();

        await this._sleep(randomInt(500, 2000));
        this._runCycle(id, config, win, sess, proxy);
    }

    _formatLocation(proxy) {
        if (!proxy || !proxy.geo) return 'direto';
        const g = proxy.geo;
        const parts = [g.city, g.region, g.country].filter(Boolean);
        return `${g.flag} ${parts.join(', ')} (${g.countryCode})`;
    }

    async _injectBypass(win) {
        try { await win.webContents.executeJavaScript(BYPASS_SCRIPT); }
        catch (e) { this.log(null, 'warn', 'Falha injeção: ' + e.message); }
    }

    async _readBypassState(win) {
        try {
            return await win.webContents.executeJavaScript(`
                (function(){ try { const r=localStorage.getItem('aincrad_bypass_state_v6'); return r?JSON.parse(r):null; } catch(e){return null;} })()
            `);
        } catch (e) { return null; }
    }

    async _readCurrentUrl(win) {
        try { return win.webContents.getURL(); } catch (e) { return ''; }
    }

    async _runCycle(id, config, win, sess, currentProxy, isRetry = false) {
        if (!this.running) return;
        const inst = this.instances.get(id);
        if (!inst) return;

        if (inst.timeoutId) clearTimeout(inst.timeoutId);
        if (inst.pollId) clearInterval(inst.pollId);

        inst.cycle++;
        inst.status = 'running';
        inst.phase = null;
        this._broadcastStatus();

        const scheduler = new Scheduler(config);

        if (scheduler.shouldTakeBreak(inst.cycle)) {
            const bt = scheduler.getBreakDuration();
            this.log(id, 'info', `Pausa ${(bt/1000).toFixed(0)}s`);
            inst.status = 'break';
            this._broadcastStatus();
            await this._sleep(bt);
        }

        // Se forçou novo proxy ou não tem, tenta pegar outro do pool atual
        if (isRetry || !currentProxy) {
            if (config.useProxies !== false) {
                const np = this.proxyManager.pickWeighted();
                if (np) {
                    try {
                        const pr = np.protocol === 'socks5' ? `socks5://${np.ip}:${np.port}` : `${np.protocol}://${np.ip}:${np.port}`;
                        await sess.setProxy({ proxyRules: pr });
                        currentProxy = np; inst.proxy = np;
                        this.log(id, 'info', `Novo proxy: ${this._formatLocation(np)} — ${np.ping}ms`);
                    } catch (e) {}
                }
            }
        }

        if (config.clearStorage !== false) {
            try { await sess.clearStorageData(); await sess.clearCache(); } catch (e) {}
        }

        const links = config.links || [];
        if (links.length === 0) {
            this.log(id, 'error', 'Nenhum link configurado');
            inst.status = 'idle'; this._broadcastStatus(); return;
        }

        const link = scheduler.pickNextLink(links, config.tierList || []);
        this.log(id, 'info', `Link: ${link}`);
        inst.status = 'bypassing'; inst.currentLink = link; this._broadcastStatus();

        const delay = scheduler.getNextDelay();
        await this._sleep(delay);
        if (!this.running || win.isDestroyed()) return;

        let navFail = false;
        try { await win.loadURL(link, { userAgent: inst.fingerprint.userAgent }); }
        catch (e) { this.log(id, 'error', `Navegação: ${e.message}`); navFail = true; }

        if (navFail) {
            this.stats.failCount++;
            this._broadcastStatus();
            inst.timeoutId = setTimeout(() => {
                if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
            }, scheduler.getNextDelay() + 3000);
            return;
        }

        await this._injectBypass(win);

        const startTime = Date.now();
        const TIMEOUT_MS = 45000;
        let resolved = false;

        inst.pollId = setInterval(async () => {
            if (resolved || !this.running || win.isDestroyed()) {
                if (inst.pollId) { clearInterval(inst.pollId); inst.pollId = null; }
                return;
            }
            const url = await this._readCurrentUrl(win);
            const bstate = await this._readBypassState(win);

            if (bstate && bstate.currentStage != null && bstate.totalStages != null) {
                inst.phase = { current: bstate.currentStage, total: bstate.totalStages };
                this._broadcastStatus();
            }

            if (url && !isSupportedHost(url) && url !== 'about:blank') {
                resolved = true;
                if (inst.pollId) { clearInterval(inst.pollId); inst.pollId = null; }
                if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
                this.log(id, 'success', `Destino: ${url.substring(0, 70)}`);
                this.stats.successCount++; this.stats.totalRuns++;
                inst.status = 'view'; inst.phase = null; this._broadcastStatus();
                inst.timeoutId = setTimeout(() => {
                    if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy);
                }, scheduler.getViewTime());
                return;
            }

            if (Date.now() - startTime > TIMEOUT_MS) {
                resolved = true;
                if (inst.pollId) { clearInterval(inst.pollId); inst.pollId = null; }
                if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
                this.log(id, 'error', 'Timeout 45s. Pulando...');
                this.stats.failCount++; inst.phase = null; this._broadcastStatus();
                inst.timeoutId = setTimeout(() => {
                    if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
                }, scheduler.getNextDelay());
            }
        }, 2000);

        inst.timeoutId = setTimeout(async () => {
            if (resolved || !this.running || win.isDestroyed()) return;
            resolved = true;
            if (inst.pollId) { clearInterval(inst.pollId); inst.pollId = null; }
            const url = await this._readCurrentUrl(win);
            if (url && !isSupportedHost(url) && url !== 'about:blank') {
                this.log(id, 'success', `Destino (late): ${url.substring(0, 70)}`);
                this.stats.successCount++; this.stats.totalRuns++;
                inst.status = 'view'; inst.phase = null; this._broadcastStatus();
                setTimeout(() => { if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy); }, scheduler.getViewTime());
            } else {
                this.log(id, 'error', 'Timeout final. Próximo...');
                this.stats.failCount++; inst.phase = null; this._broadcastStatus();
                this._runCycle(id, config, win, sess, currentProxy, true);
            }
        }, TIMEOUT_MS + 3000);
    }

    async stopAll() {
        this.running = false;
        this.proxyManager.stopScanner();
        this.log('MAIN', 'info', 'Parando...');
        for (const [id, inst] of this.instances) {
            if (inst.timeoutId) clearTimeout(inst.timeoutId);
            if (inst.pollId) clearInterval(inst.pollId);
            try { if (inst.window && !inst.window.isDestroyed()) inst.window.close(); } catch (e) {}
        }
        this.instances.clear(); this._broadcastStatus();
        return { ok: true };
    }

    getStatus() {
        const elapsed = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        return {
            running: this.running,
            instances: Array.from(this.instances.entries()).map(([id, inst]) => ({
                id, status: inst.status, cycle: inst.cycle,
                currentLink: inst.currentLink || null, phase: inst.phase,
                proxy: inst.proxy ? this._formatLocation(inst.proxy) : 'direto',
                proxyPing: inst.proxy ? inst.proxy.ping : null,
                proxyTier: inst.proxy ? inst.proxy.tier : null,
                fingerprint: inst.fingerprint?.userAgent?.substring(0, 35) + '...'
            })),
            stats: {
                ...this.stats,
                elapsed: `${h}h ${m}m ${s}s`,
                successRate: this.stats.totalRuns > 0
                    ? ((this.stats.successCount / this.stats.totalRuns) * 100).toFixed(1) + '%'
                    : '0%'
            },
            logs: this.logs.slice(0, 50)
        };
    }

    clearLogs() { this.logs = []; }
    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = FarmEngine;