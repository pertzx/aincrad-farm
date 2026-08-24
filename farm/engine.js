const { BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { generateFingerprint, randomInt } = require('./fingerprint');
const Scheduler = require('./scheduler');

const BYPASS_SCRIPT = fs.readFileSync(path.join(__dirname, 'bypass-inject.js'), 'utf-8');

const SUPPORTED_ROOTS = [
    'alpharede.com', 'rodaemotor.com', 'guis2.com', 'horoscopeonday.com',
    'forumdinheiro.com', 'milbviral.com', 'tarviral.com', 'gsmods.com'
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
        this.healthCheckInterval = null;
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

    async _sendWebhook(message) {
        const cfg = this.configStore.get('webhook', { enabled: false });
        if (!cfg.enabled) return;
        try {
            const fetch = (await import('node-fetch')).default;
            if (cfg.type === 'discord' && cfg.url) {
                await fetch(cfg.url, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: message })
                });
            }
            if (cfg.type === 'telegram' && cfg.botToken && cfg.chatId) {
                await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: cfg.chatId, text: message, parse_mode: 'Markdown' })
                });
            }
        } catch (e) { console.error('[Webhook]', e.message); }
    }

    _recordSuccess(link) {
        const today = new Date().toISOString().split('T')[0];
        const stats = this.configStore.get('linkStats', {});
        if (!stats[link]) stats[link] = { success: 0, fail: 0, lastSuccess: null };
        stats[link].success++;
        stats[link].lastSuccess = new Date().toISOString();
        this.configStore.set('linkStats', stats);

        const daily = this.configStore.get('dailyStats', {});
        if (!daily[today]) daily[today] = { success: 0, fail: 0 };
        daily[today].success++;
        this.configStore.set('dailyStats', daily);
        this.configStore.set('totalSuccess', this.configStore.get('totalSuccess', 0) + 1);

        // Reset fail count on success
        const bl = this.configStore.get('pausedLinks', {});
        if (bl[link]) { delete bl[link]; this.configStore.set('pausedLinks', bl); }

        // Record last used
        const lu = this.configStore.get('linkLastUsed', {});
        lu[link] = Date.now();
        this.configStore.set('linkLastUsed', lu);
    }

    _recordFail(link) {
        const today = new Date().toISOString().split('T')[0];
        const stats = this.configStore.get('linkStats', {});
        if (!stats[link]) stats[link] = { success: 0, fail: 0, lastSuccess: null };
        stats[link].fail++;
        this.configStore.set('linkStats', stats);

        const daily = this.configStore.get('dailyStats', {});
        if (!daily[today]) daily[today] = { success: 0, fail: 0 };
        daily[today].fail++;
        this.configStore.set('dailyStats', daily);
        this.configStore.set('totalFail', this.configStore.get('totalFail', 0) + 1);

        // Blacklist check
        const blacklistCfg = this.configStore.get('blacklist', { enabled: true, maxFails: 5, cooldownMinutes: 30 });
        if (blacklistCfg.enabled) {
            const bl = this.configStore.get('pausedLinks', {});
            const fails = (stats[link].fail || 0) - (stats[link].success || 0);
            if (fails >= blacklistCfg.maxFails) {
                bl[link] = { pausedAt: Date.now(), reason: 'blacklist' };
                this.configStore.set('pausedLinks', bl);
                this.log('MAIN', 'warn', `⛔ Link blacklisted: ${link} (${blacklistCfg.cooldownMinutes}min cooldown)`);
                this._sendWebhook(`⛔ **Link Blacklisted**\n${link}\nCooldown: ${blacklistCfg.cooldownMinutes} minutos`);
            }
        }
    }

    _checkGoal() {
        const goal = this.configStore.get('dailyGoal', { enabled: false, amount: 50 });
        if (!goal.enabled) return false;
        const perBypass = this.configStore.get('earningsPerBypass', 0.05);
        const today = new Date().toISOString().split('T')[0];
        const daily = this.configStore.get('dailyStats', {});
        const todaySuccess = (daily[today] && daily[today].success) || 0;
        const earned = todaySuccess * perBypass;
        if (earned >= goal.amount) {
            this.log('MAIN', 'success', `🎉 Meta diária de R$ ${goal.amount.toFixed(2)} batida!`);
            this._sendWebhook(`🎉 **Meta Diária Atingida!**\nGanhos: R$ ${earned.toFixed(2)} / R$ ${goal.amount.toFixed(2)}`);
            return true;
        }
        return false;
    }

    async start(config) {
        if (this.running) return { ok: false, error: 'Já está rodando' };
        if (this._checkGoal()) return { ok: false, error: 'Meta diária já foi batida!' };

        this.running = true;
        this.stats.startTime = Date.now();
        const count = Math.min(Math.max(1, config.instances || 1), 10);
        this.log('MAIN', 'info', `Iniciando farm com ${count} instância(s)...`);
        this._sendWebhook(`🚀 **Farm Iniciado**\nInstâncias: ${count}\nLinks: ${(config.links || []).length}`);

        if (config.useProxies !== false) {
            this.proxyManager.startScanner();
            const existing = this.proxyManager.getProxies();
            if (existing.length > 0) {
                this.log('MAIN', 'info', `${existing.length} proxies no cache`);
            } else {
                this.log('MAIN', 'warn', 'Nenhum proxy ainda — usando IP direto até carregar');
            }
            this._broadcast('proxy:updated', existing);
        }

        // No start(), em vez de setInterval simples:
        this.healthCheckInterval = setInterval(async () => {
            if (!this.running) return;
            // Faz health check em streaming também
            await this.proxyManager.healthCheckAll();
        }, 300000); // 5 min

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
            try { await sess.clearStorageData(); await sess.clearCache(); } catch (e) { }
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
            timeoutId: null, pollId: null, resolved: false
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
                (function(){ try { const r=localStorage.getItem('gs_bypass_state_v6'); return r?JSON.parse(r):null; } catch(e){return null;} })()
            `);
        } catch (e) { return null; }
    }

    async _readCurrentUrl(win) {
        try { return win.webContents.getURL(); } catch (e) { return ''; }
    }

    async _runCycle(id, config, win, sess, currentProxy, isRetry = false) {
        if (!this.running) return;
        if (this._checkGoal()) { this.stopAll(); return; }

        const inst = this.instances.get(id);
        if (!inst) return;

        if (inst.timeoutId) clearTimeout(inst.timeoutId);
        if (inst.pollId) clearTimeout(inst.pollId);

        inst.cycle++;
        inst.status = 'running';
        inst.phase = null;
        inst.resolved = false;
        this._broadcastStatus();

        const scheduler = new Scheduler(config, this.configStore);

        if (scheduler.shouldTakeBreak(inst.cycle)) {
            const bt = scheduler.getBreakDuration();
            this.log(id, 'info', `Pausa ${(bt / 1000).toFixed(0)}s`);
            inst.status = 'break';
            this._broadcastStatus();
            await this._sleep(bt);
        }

        if (isRetry || !currentProxy) {
            if (config.useProxies !== false) {
                const np = this.proxyManager.pickWeighted();
                if (np) {
                    try {
                        const pr = np.protocol === 'socks5' ? `socks5://${np.ip}:${np.port}` : `${np.protocol}://${np.ip}:${np.port}`;
                        await sess.setProxy({ proxyRules: pr });
                        currentProxy = np; inst.proxy = np;
                        this.log(id, 'info', `Novo proxy: ${this._formatLocation(np)} — ${np.ping}ms`);
                    } catch (e) { }
                }
            }
        }

        if (config.clearStorage !== false) {
            try { await sess.clearStorageData(); await sess.clearCache(); } catch (e) { }
        }

        const links = config.links || [];
        if (links.length === 0) {
            this.log(id, 'error', 'Nenhum link configurado');
            inst.status = 'idle'; this._broadcastStatus(); return;
        }

        const link = scheduler.pickNextLink(links);
        if (!link) {
            this.log(id, 'warn', 'Todos os links em cooldown/blacklist. Aguardando...');
            inst.timeoutId = setTimeout(() => {
                if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy);
            }, 10000);
            return;
        }

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
            this._recordFail(link);
            this._broadcastStatus();
            inst.timeoutId = setTimeout(() => {
                if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
            }, scheduler.getNextDelay() + 3000);
            return;
        }

        await this._injectBypass(win);

        const startTime = Date.now();
        const TIMEOUT_MS = 45000;

        const doPoll = async () => {
            if (inst.resolved || !this.running || win.isDestroyed()) return;

            const url = await this._readCurrentUrl(win);
            if (inst.resolved) return;

            const bstate = await this._readBypassState(win);
            if (inst.resolved) return;

            if (bstate && bstate.currentStage != null && bstate.totalStages != null) {
                inst.phase = { current: bstate.currentStage, total: bstate.totalStages };
                this._broadcastStatus();
            }

            if (url && !isSupportedHost(url) && url !== 'about:blank') {
                if (inst.resolved) return;
                inst.resolved = true;
                if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
                if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
                this.log(id, 'success', `Destino: ${url.substring(0, 70)}`);
                this.stats.successCount++; this.stats.totalRuns++;
                this._recordSuccess(link);
                inst.status = 'view'; inst.phase = null; this._broadcastStatus();

                inst.timeoutId = setTimeout(() => {
                    if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy);
                }, scheduler.getViewTime());
                return;
            }

            if (Date.now() - startTime > TIMEOUT_MS) {
                if (inst.resolved) return;
                inst.resolved = true;
                if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
                if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
                this.log(id, 'error', 'Timeout 45s. Pulando...');
                this.stats.failCount++;
                this._recordFail(link);
                inst.phase = null; this._broadcastStatus();
                inst.timeoutId = setTimeout(() => {
                    if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
                }, scheduler.getNextDelay());
                return;
            }

            inst.pollId = setTimeout(doPoll, 2000);
        };

        inst.pollId = setTimeout(doPoll, 2000);

        inst.timeoutId = setTimeout(async () => {
            if (inst.resolved || !this.running || win.isDestroyed()) return;
            inst.resolved = true;
            if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
            const url = await this._readCurrentUrl(win);
            if (url && !isSupportedHost(url) && url !== 'about:blank') {
                this.log(id, 'success', `Destino (late): ${url.substring(0, 70)}`);
                this.stats.successCount++; this.stats.totalRuns++;
                this._recordSuccess(link);
                inst.status = 'view'; inst.phase = null; this._broadcastStatus();
                setTimeout(() => { if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy); }, scheduler.getViewTime());
            } else {
                this.log(id, 'error', 'Timeout final. Próximo...');
                this.stats.failCount++;
                this._recordFail(link);
                inst.phase = null; this._broadcastStatus();
                this._runCycle(id, config, win, sess, currentProxy, true);
            }
        }, TIMEOUT_MS + 3000);
    }

    async stopAll() {
        this.running = false;
        // this.proxyManager.stopScanner(); // nao prescisa mais parar!!
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.log('MAIN', 'info', 'Parando...');
        this._sendWebhook('⏹ **Farm Parado**');
        for (const [id, inst] of this.instances) {
            if (inst.timeoutId) clearTimeout(inst.timeoutId);
            if (inst.pollId) clearTimeout(inst.pollId);
            try { if (inst.window && !inst.window.isDestroyed()) inst.window.close(); } catch (e) { }
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
