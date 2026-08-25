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

        const bl = this.configStore.get('pausedLinks', {});
        if (bl[link]) { delete bl[link]; this.configStore.set('pausedLinks', bl); }

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
            this.log('MAIN', 'success', `🎉 Meta diaria de R$ ${goal.amount.toFixed(2)} batida!`);
            this._sendWebhook(`🎉 **Meta Diaria Atingida!**\nGanhos: R$ ${earned.toFixed(2)} / R$ ${goal.amount.toFixed(2)}`);
            return true;
        }
        return false;
    }

    async start(config) {
        if (this.running) return { ok: false, error: 'Ja esta rodando' };
        if (this._checkGoal()) return { ok: false, error: 'Meta diaria ja foi batida!' };

        this.running = true;
        this.stats.startTime = Date.now();
        const count = Math.min(Math.max(1, config.instances || 1), 10);
        this.log('MAIN', 'info', `Iniciando farm com ${count} instancia(s)...`);
        this._sendWebhook(`🚀 **Farm Iniciado**\nInstancias: ${count}\nLinks: ${(config.links || []).length}`);

        if (config.useProxies !== false) {
            this.proxyManager.startScanner();
            const existing = this.proxyManager.getProxies();
            if (existing.length > 0) {
                this.log('MAIN', 'info', `${existing.length} proxies no cache`);
            } else {
                this.log('MAIN', 'warn', 'Nenhum proxy ainda — usando IP direto ate carregar');
            }
            this._broadcast('proxy:updated', existing);
        }

        this.healthCheckInterval = setInterval(async () => {
            if (!this.running) return;
            await this.proxyManager.healthCheckAll();
        }, 300000);

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
            this.log(id, 'info', 'Sem proxy disponivel — usando IP direto');
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
            timeoutId: null, pollId: null, resolved: false,
            finalUrl: null,
            lastAdClickCoords: null,
            adClickAttempts: 0,
            maxAdClickAttempts: 8,
            adClickCoords: [],
            currentCoordIndex: 0
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
        catch (e) { this.log(null, 'warn', 'Falha injecao: ' + e.message); }
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

    // ============================================================
    // Detecta fase atual buscando texto "X/Y" na pagina
    // ============================================================
    async _detectPhaseFromPage(win) {
        try {
            const result = await win.webContents.executeJavaScript(`
                (function(){
                    const bodyText = document.body ? document.body.innerText : '';
                    const match = bodyText.match(/(\\d+)\\s*[/\\-]\\s*(\\d+)/);
                    if (match) {
                        return { current: parseInt(match[1], 10), total: parseInt(match[2], 10), text: match[0] };
                    }
                    const allElements = document.querySelectorAll('*');
                    for (let i = 0; i < Math.min(allElements.length, 200); i++) {
                        const el = allElements[i];
                        const text = el.innerText || el.textContent || '';
                        const m = text.match(/(\\d+)\\s*[/\\-]\\s*(\\d+)/);
                        if (m) {
                            const style = window.getComputedStyle(el);
                            const isProminent = parseFloat(style.fontSize) >= 14 || 
                                                style.fontWeight === 'bold' || 
                                                parseInt(style.zIndex) > 0 ||
                                                el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3';
                            if (isProminent || i < 50) {
                                return { current: parseInt(m[1], 10), total: parseInt(m[2], 10), text: m[0] };
                            }
                        }
                    }
                    return null;
                })()
            `);
            return result;
        } catch (e) { return null; }
    }

    // ============================================================
    // CLICA POR COORDENADAS (multiplas tentativas)
    // Nao depende de detectar botoes — so coordenadas
    // ============================================================
    async _clickByCoordinates(win, coords) {
        const wc = win.webContents;
        const { x, y } = coords;

        this.log(null, 'info', `🎯 CLICK em (${x}, ${y}) — ${coords.label || 'coordenada'}`);

        try {
            wc.sendInputEvent({ type: 'mouseMove', x, y });
            await this._sleep(200);
            wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
            await this._sleep(150);
            wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
            await this._sleep(400);
            wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
            await this._sleep(100);
            wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
            await this._sleep(1500);
            return true;
        } catch (e) {
            this.log(null, 'warn', `Erro no click em (${x},${y}): ${e.message}`);
            return false;
        }
    }

    // ============================================================
    // Tenta multiplas coordenadas no anuncio, uma por vez
    // ============================================================
    async _tryAdClickCoordinates(win, coordsList, inst) {
        if (!coordsList || coordsList.length === 0) return false;

        for (let i = 0; i < coordsList.length; i++) {
            if (inst.resolved) return false;
            const coords = coordsList[i];
            inst.currentCoordIndex = i;
            inst.lastAdClickCoords = coords;
            this._broadcastStatus();

            this.log(null, 'info', `🎯 Tentativa ${i + 1}/${coordsList.length} — (${coords.x}, ${coords.y}) [${coords.label}]`);

            const clicked = await this._clickByCoordinates(win, coords);
            if (!clicked) continue;

            // Aguarda pra ver se URL mudou ou se window.open capturou algo
            await this._sleep(2500);

            // Verifica se window.open capturou URL final
            const openedUrl = await this._readOpenedUrl(win);
            if (openedUrl && !isSupportedHost(openedUrl)) {
                this.log(null, 'success', `✅ window.open capturou: ${openedUrl.substring(0, 60)}`);
                inst.finalUrl = openedUrl;
                return 'opened';
            }

            // Verifica se a URL atual mudou pra fora do site suportado
            const currentUrl = win.webContents.getURL();
            if (!isSupportedHost(currentUrl) && currentUrl !== 'about:blank') {
                this.log(null, 'success', `✅ Navegou para: ${currentUrl.substring(0, 60)}`);
                return 'navigated';
            }
        }

        return false;
    }

    // ============================================================
    // Gera coordenadas candidatas para clique no anuncio
    // ============================================================
    async _generateAdClickCoords(win) {
        try {
            const coords = await win.webContents.executeJavaScript(`
                (function(){
                    const coords = [];
                    const w = window.innerWidth;
                    const h = window.innerHeight;

                    // 1. Tenta encontrar iframes de anuncio
                    const iframes = document.querySelectorAll('iframe');
                    for (let i = 0; i < iframes.length; i++) {
                        const iframe = iframes[i];
                        const rect = iframe.getBoundingClientRect();
                        if (rect.width < 50 || rect.height < 50) continue;

                        const src = (iframe.src || '').toLowerCase();
                        const parent = iframe.parentElement;
                        const parentCls = parent ? (parent.className || '').toLowerCase() : '';

                        const isAd = src.indexOf('google') !== -1 || 
                                     src.indexOf('doubleclick') !== -1 || 
                                     src.indexOf('ads') !== -1 ||
                                     parentCls.indexOf('ad') !== -1 ||
                                     parentCls.indexOf('ads') !== -1;

                        if (isAd || rect.width > 200 || rect.height > 100) {
                            // Centro do iframe
                            coords.push({
                                x: Math.round(rect.left + rect.width / 2),
                                y: Math.round(rect.top + rect.height / 2),
                                label: 'iframe-center',
                                source: 'iframe'
                            });
                            // Pontos em grid dentro do iframe
                            const cols = 3, rows = 2;
                            for (let r = 0; r < rows; r++) {
                                for (let c = 0; c < cols; c++) {
                                    coords.push({
                                        x: Math.round(rect.left + rect.width * (c + 0.5) / cols),
                                        y: Math.round(rect.top + rect.height * (r + 0.5) / rows),
                                        label: 'iframe-grid-' + r + '-' + c,
                                        source: 'iframe-grid'
                                    });
                                }
                            }
                        }
                    }

                    // 2. Tenta encontrar containers de anuncio
                    const adSelectors = [
                        '.ad-container', '[class*="ad"]', '[id*="ad"]',
                        '.adsbygoogle', '.advertisement', '.banner',
                        '[data-ad-slot]', '[data-ad-client]'
                    ];
                    for (let s = 0; s < adSelectors.length; s++) {
                        const els = document.querySelectorAll(adSelectors[s]);
                        for (let i = 0; i < els.length; i++) {
                            const el = els[i];
                            const rect = el.getBoundingClientRect();
                            if (rect.width < 30 || rect.height < 30) continue;
                            coords.push({
                                x: Math.round(rect.left + rect.width / 2),
                                y: Math.round(rect.top + rect.height / 2),
                                label: 'ad-container-center',
                                source: 'ad-container'
                            });
                        }
                    }

                    // 3. Coordenadas genericas (centro da tela, areas comuns de anuncio)
                    coords.push({ x: Math.round(w / 2), y: Math.round(h / 2), label: 'screen-center', source: 'generic' });
                    coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.12), label: 'top-center', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.25), y: Math.round(h * 0.12), label: 'top-left', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.75), y: Math.round(h * 0.12), label: 'top-right', source: 'generic' });
                    coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.25), label: 'upper-mid-center', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.25), label: 'upper-mid-left', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.25), label: 'upper-mid-right', source: 'generic' });
                    coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.4), label: 'mid-center', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.4), label: 'mid-left', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.4), label: 'mid-right', source: 'generic' });
                    coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.55), label: 'lower-mid-center', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.55), label: 'lower-mid-left', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.55), label: 'lower-mid-right', source: 'generic' });
                    coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.75), label: 'lower-center', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.75), label: 'lower-left', source: 'generic' });
                    coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.75), label: 'lower-right', source: 'generic' });

                    return coords;
                })()
            `);
            return coords;
        } catch (e) {
            this.log(null, 'warn', 'Erro ao gerar coordenadas: ' + e.message);
            return [];
        }
    }

    // ============================================================
    // Le a URL final esperada do bypass-inject state
    // ============================================================
    async _readFinalUrl(win) {
        try {
            return await win.webContents.executeJavaScript(`
                (function(){ 
                    try { 
                        const r = localStorage.getItem('gs_bypass_state_v6'); 
                        if (!r) return null;
                        const state = JSON.parse(r);
                        return state.finalUrl || null;
                    } catch(e){ return null; } 
                })()
            `);
        } catch (e) { return null; }
    }

    // ============================================================
    // Le a URL que foi aberta via window.open (capturada pelo bypass)
    // ============================================================
    async _readOpenedUrl(win) {
        try {
            return await win.webContents.executeJavaScript(`
                (function(){
                    try {
                        if (window.__gs_lastOpenedUrl && (Date.now() - window.__gs_lastOpenTime) < 10000) {
                            return window.__gs_lastOpenedUrl;
                        }
                        return null;
                    } catch(e) { return null; }
                })()
            `);
        } catch (e) { return null; }
    }

    // ============================================================
    // Verifica se a instancia chegou na URL final
    // CRITERIO UNICO DE SUCESSO: estar na URL final
    // ============================================================
    async _checkReachedFinalUrl(win, expectedFinalUrl) {
        if (!expectedFinalUrl) return false;
        try {
            const currentUrl = win.webContents.getURL();
            // Normaliza URLs para comparacao
            const normCurrent = currentUrl.replace(/\/$/, '').toLowerCase();
            const normExpected = expectedFinalUrl.replace(/\/$/, '').toLowerCase();

            // Correspondencia direta ou uma contem a outra
            if (normCurrent === normExpected || normCurrent.includes(normExpected) || normExpected.includes(normCurrent)) {
                return true;
            }
            // Se a URL atual nao eh mais um site suportado E temos uma URL final esperada diferente
            if (!isSupportedHost(currentUrl) && currentUrl !== 'about:blank' && expectedFinalUrl) {
                // Verifica se o dominio da URL atual corresponde ao da URL final esperada
                try {
                    const currentHost = new URL(currentUrl).hostname.toLowerCase();
                    const finalHost = new URL(expectedFinalUrl).hostname.toLowerCase();
                    if (currentHost === finalHost || currentHost.endsWith('.' + finalHost) || finalHost.endsWith('.' + currentHost)) {
                        return true;
                    }
                } catch (e) {}
            }
            return false;
        } catch (e) { return false; }
    }

    // ============================================================
    // Marca sucesso e encerra ciclo
    // ============================================================
    _resolveSuccess(id, inst, link, url, scheduler) {
        if (inst.resolved) return;
        inst.resolved = true;
        if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
        if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
        this.log(id, 'success', `✅ SUCESSO — URL final: ${(url || '').substring(0, 70)}`);
        this.stats.successCount++; this.stats.totalRuns++;
        this._recordSuccess(link);
        inst.status = 'view'; inst.phase = null; this._broadcastStatus();

        inst.timeoutId = setTimeout(() => {
            if (this.running && !inst.window.isDestroyed()) this._runCycle(id, { ...this.configStore.getAll(), links: this.configStore.get('links', []) }, inst.window, inst.session, inst.proxy);
        }, scheduler.getViewTime());
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
        inst.finalUrl = null;
        inst.adClickAttempts = 0;
        inst.adClickCoords = [];
        inst.currentCoordIndex = -1;
        inst.lastAdClickCoords = null;
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
        catch (e) { this.log(id, 'error', `Navegacao: ${e.message}`); navFail = true; }

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
        const TIMEOUT_MS = 90000; // 90s timeout

        const doPoll = async () => {
            if (inst.resolved || !this.running || win.isDestroyed()) return;

            const url = await this._readCurrentUrl(win);
            if (inst.resolved) return;

            // Detecta fase atual pelo texto "X/Y" na pagina
            const pagePhase = await this._detectPhaseFromPage(win);
            if (pagePhase && !inst.resolved) {
                inst.phase = { current: pagePhase.current, total: pagePhase.total, text: pagePhase.text };
                this._broadcastStatus();
            }

            // Le a URL final esperada do state
            const expectedFinalUrl = await this._readFinalUrl(win);
            if (expectedFinalUrl && !inst.finalUrl) {
                inst.finalUrl = expectedFinalUrl;
                this.log(id, 'info', `📌 URL final esperada: ${expectedFinalUrl.substring(0, 60)}`);
                this._broadcastStatus();
            }

            // Le URL aberta via window.open
            const openedUrl = await this._readOpenedUrl(win);
            if (openedUrl && !inst.finalUrl) {
                inst.finalUrl = openedUrl;
                this.log(id, 'info', `📌 URL capturada (window.open): ${openedUrl.substring(0, 60)}`);
                this._broadcastStatus();
            }

            // ===== CRITERIO UNICO DE SUCESSO: estar na URL final =====
            const reachedFinal = await this._checkReachedFinalUrl(win, inst.finalUrl);
            if (reachedFinal && !inst.resolved) {
                this._resolveSuccess(id, inst, link, url, scheduler);
                return;
            }

            // Se ja temos URL final mas ainda nao chegamos, continua tentando (nao marca sucesso ainda)

            // ===== TENTA CLICAR NO ANUNCIO POR COORDENADAS =====
            if (inst.adClickAttempts < inst.maxAdClickAttempts && !inst.resolved) {
                inst.adClickAttempts++;

                // Gera coordenadas na primeira tentativa
                if (inst.adClickCoords.length === 0) {
                    inst.adClickCoords = await this._generateAdClickCoords(win);
                    this.log(id, 'info', `🎯 ${inst.adClickCoords.length} coordenadas candidatas geradas`);
                    inst.adClickCoords.forEach((c, i) => {
                        this.log(id, 'info', `   📍 [${i + 1}] (${c.x}, ${c.y}) — ${c.label}`);
                    });
                    this._broadcastStatus();
                }

                if (inst.adClickCoords.length > 0) {
                    const result = await this._tryAdClickCoordinates(win, inst.adClickCoords, inst);
                    
                    // Se window.open capturou URL final
                    if (result === 'opened' && inst.finalUrl && !inst.resolved) {
                        const reached = await this._checkReachedFinalUrl(win, inst.finalUrl);
                        if (reached) {
                            this._resolveSuccess(id, inst, link, inst.finalUrl, scheduler);
                            return;
                        }
                    }
                    
                    // Se navegou para fora do site
                    if (result === 'navigated' && inst.finalUrl && !inst.resolved) {
                        const reached = await this._checkReachedFinalUrl(win, inst.finalUrl);
                        if (reached) {
                            this._resolveSuccess(id, inst, link, win.webContents.getURL(), scheduler);
                            return;
                        }
                    }

                    // Se ainda nao chegou na URL final, continua o poll (vai tentar mais coordenadas na proxima rodada)
                    if (!inst.resolved) {
                        this.log(id, 'info', `⏳ Coordenada nao abriu destino. Tentando proxima...`);
                    }
                }
            }

            // ===== TIMEOUT =====
            if (Date.now() - startTime > TIMEOUT_MS) {
                if (inst.resolved) return;
                inst.resolved = true;
                if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
                if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
                this.log(id, 'error', `⏱ Timeout ${TIMEOUT_MS/1000}s. URL final nao alcancada.`);
                this.stats.failCount++;
                this._recordFail(link);
                inst.phase = null; inst.finalUrl = null; this._broadcastStatus();
                inst.timeoutId = setTimeout(() => {
                    if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
                }, scheduler.getNextDelay());
                return;
            }

            inst.pollId = setTimeout(doPoll, 3000);
        };

        inst.pollId = setTimeout(doPoll, 3000);

        inst.timeoutId = setTimeout(async () => {
            if (inst.resolved || !this.running || win.isDestroyed()) return;
            inst.resolved = true;
            if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
            const url = await this._readCurrentUrl(win);

            // Ultima verificacao de URL final
            const finalCheck = await this._checkReachedFinalUrl(win, inst.finalUrl);

            if (finalCheck) {
                this._resolveSuccess(id, inst, link, url, scheduler);
            } else {
                this.log(id, 'error', `⏱ Timeout final. URL final nao alcancada.`);
                this.stats.failCount++;
                this._recordFail(link);
                inst.phase = null; inst.finalUrl = null; this._broadcastStatus();
                this._runCycle(id, config, win, sess, currentProxy, true);
            }
        }, TIMEOUT_MS + 10000);
    }

    async stopAll() {
        this.running = false;
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
                currentLink: inst.currentLink || null, 
                phase: inst.phase,
                proxy: inst.proxy ? this._formatLocation(inst.proxy) : 'direto',
                proxyPing: inst.proxy ? inst.proxy.ping : null,
                proxyTier: inst.proxy ? inst.proxy.tier : null,
                fingerprint: inst.fingerprint?.userAgent?.substring(0, 35) + '...',
                finalUrl: inst.finalUrl ? inst.finalUrl.substring(0, 40) + '...' : null,
                adClickAttempts: inst.adClickAttempts,
                adClickCoordsCount: inst.adClickCoords ? inst.adClickCoords.length : 0,
                currentCoordIndex: inst.currentCoordIndex,
                lastAdClickCoords: inst.lastAdClickCoords
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