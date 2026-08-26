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
            const existing = this.proxyManager.getTopPool();
            if (existing.length > 0) {
                this.log('MAIN', 'info', `Top pool: ${existing.length} proxies elite`);
            } else {
                this.log('MAIN', 'warn', 'Top pool vazio — usando IP direto ate carregar');
            }
            this._broadcast('proxy:updated', this.proxyManager.getProxies());
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

        sess.setCertificateVerifyProc((request, callback) => {
            callback(0);
        });

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
            title: `${ proxy ? proxy.url : 'Sem proxy⚠️' } : Farm #${id + 1}`, backgroundColor: '#0c0c14'
        });

        win.webContents.setWindowOpenHandler(({ url }) => {
            const inst = this.instances.get(id);
            if (inst) {
                inst.lastPopupUrl = url;
                inst.lastPopupTime = Date.now();
            }
            return { action: 'allow' };
        });

        win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            if (errorCode !== -3) {
                this.log(id, 'warn', `⚠️ Falha navegacao: ${errorDescription} (code: ${errorCode})`);
                const inst = this.instances.get(id);
                if (inst && !inst.resolved && inst.proxy) {
                    this._handleProxyFailure(id, inst, 'nav_fail');
                }
            }
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
            maxAdClickAttempts: 12,
            adClickCoords: [],
            currentCoordIndex: 0,
            lastPopupUrl: null,
            lastPopupTime: 0,
            _proxyFailed: false,
            _cycleStartTime: 0,
            _lastActionTime: 0
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

    // ============================================================
    // FAST-FAIL: detecta proxy ruim e aborta IMEDIATAMENTE
    // ============================================================
    _handleProxyFailure(id, inst, reason) {
        if (inst._proxyFailed) return; // já está tratando
        inst._proxyFailed = true;

        if (inst.proxy) {
            this.log(id, 'warn', `🔄 Proxy ruim detectado (${reason}) — adicionando strike e trocando...`);
            this.proxyManager.addStrike(inst.proxy);
        }

        // Aborta tudo imediatamente
        if (inst.pollId) { clearTimeout(inst.pollId); inst.pollId = null; }
        if (inst.timeoutId) { clearTimeout(inst.timeoutId); inst.timeoutId = null; }
        inst.resolved = true;

        // Limpa sessão
        try { inst.session.clearStorageData(); } catch (e) {}

        // Retry com nova proxy em 2s
        inst.timeoutId = setTimeout(() => {
            if (this.running && !inst.window.isDestroyed()) {
                this._runCycle(id, { ...this.configStore.getAll(), links: this.configStore.get('links', []) }, inst.window, inst.session, null, true);
            }
        }, 2000);
    }

    // Verifica se a proxy está congelando (demorando demais)
    _checkProxyStalled(inst, maxMs, label) {
        const elapsed = Date.now() - inst._lastActionTime;
        if (elapsed > maxMs) {
            this.log(inst.id !== undefined ? inst.id : null, 'warn', `⏱ ${label} demorou ${elapsed}ms — proxy congelada`);
            return true;
        }
        return false;
    }

    async _injectBypass(win) {
        try { await win.webContents.executeJavaScript(BYPASS_SCRIPT); }
        catch (e) { this.log(null, 'warn', 'Falha injecao: ' + e.message); }
    }

    async _readCurrentUrl(win) {
        try { return win.webContents.getURL(); } catch (e) { return ''; }
    }

    async _detectPhaseFromPage(win) {
        try {
            const result = await win.webContents.executeJavaScript(`
                (function(){
                    const bodyText = document.body ? document.body.innerText : '';
                    const match = bodyText.match(/(\d+)\s*[\/\-]\s*(\d+)/);
                    if (match) {
                        return { current: parseInt(match[1], 10), total: parseInt(match[2], 10), text: match[0] };
                    }
                    const allElements = document.querySelectorAll('*');
                    for (let i = 0; i < Math.min(allElements.length, 200); i++) {
                        const el = allElements[i];
                        const text = el.innerText || el.textContent || '';
                        const m = text.match(/(\d+)\s*[\/\-]\s*(\d+)/);
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

    async _showClickVisual(win, x, y) {
        try {
            await win.webContents.executeJavaScript(`
                (function(){
                    const id = 'gs-click-marker';
                    let el = document.getElementById(id);
                    if (el) el.remove();
                    el = document.createElement('div');
                    el.id = id;
                    el.style.cssText = 'position:fixed;left:${x}px;top:${y}px;width:20px;height:20px;margin-left:-10px;margin-top:-10px;border-radius:50%;background:rgba(239,68,68,0.8);border:2px solid #fff;box-shadow:0 0 10px rgba(239,68,68,0.8);z-index:99999999999999999;pointer-events:none;animation:gs-pulse 0.6s ease-in-out 3;';
                    const style = document.createElement('style');
                    style.textContent = '@keyframes gs-pulse{0%{transform:scale(1);opacity:1;}50%{transform:scale(1.6);opacity:0.5;}100%{transform:scale(1);opacity:1;}}';
                    if (!document.getElementById('gs-pulse-style')) {
                        style.id = 'gs-pulse-style';
                        document.head.appendChild(style);
                    }
                    document.body.appendChild(el);
                    setTimeout(() => { const e = document.getElementById(id); if(e) e.remove(); }, 2500);
                })()
            `);
        } catch (e) {}
    }

    async _nativeClick(win, coords) {
        const wc = win.webContents;
        const { x, y } = coords;

        try {
            if (!win.isFocused()) {
                win.focus();
                await this._sleep(100);
            }

            await wc.executeJavaScript(`
                (function(){
                    const el = document.elementFromPoint(${x}, ${y});
                    if (el) {
                        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                    } else {
                        window.scrollTo({ top: Math.max(0, ${y} - window.innerHeight/2), behavior: 'instant' });
                    }
                    return { scrollX: window.scrollX, scrollY: window.scrollY };
                })()
            `);
            await this._sleep(400);

            const adjusted = await wc.executeJavaScript(`
                (function(){
                    const adjX = ${x} - window.scrollX;
                    const adjY = ${y} - window.scrollY;
                    return { x: adjX, y: adjY, sx: window.scrollX, sy: window.scrollY };
                })()
            `);

            const targetX = Math.round(adjusted.x);
            const targetY = Math.round(adjusted.y);

            this.log(null, 'info', `🎯 NATIVE CLICK em (${targetX}, ${targetY}) [scroll: ${adjusted.sx},${adjusted.sy}] — ${coords.label || 'coord'}`);

            await this._showClickVisual(win, targetX, targetY);

            const steps = 5;
            const startX = targetX + randomInt(-80, 80);
            const startY = targetY + randomInt(-80, 80);
            for (let i = 0; i <= steps; i++) {
                const px = Math.round(startX + (targetX - startX) * (i / steps));
                const py = Math.round(startY + (targetY - startY) * (i / steps));
                wc.sendInputEvent({ type: 'mouseMove', x: px, y: py });
                await this._sleep(randomInt(30, 80));
            }

            await this._sleep(randomInt(150, 350));
            wc.sendInputEvent({ type: 'mouseDown', x: targetX, y: targetY, button: 'left', clickCount: 1 });
            await this._sleep(randomInt(80, 150));
            wc.sendInputEvent({ type: 'mouseUp', x: targetX, y: targetY, button: 'left', clickCount: 1 });
            await this._sleep(randomInt(100, 200));
            wc.sendInputEvent({ type: 'mouseDown', x: targetX, y: targetY, button: 'left', clickCount: 1 });
            await this._sleep(randomInt(60, 120));
            wc.sendInputEvent({ type: 'mouseUp', x: targetX, y: targetY, button: 'left', clickCount: 1 });

            await this._sleep(3000);

            return { ok: true, x: targetX, y: targetY };
        } catch (e) {
            this.log(null, 'warn', `Erro native click em (${x},${y}): ${e.message}`);
            return { ok: false };
        }
    }

    async _tryAdClickCoordinates(win, coordsList, inst) {
        if (!coordsList || coordsList.length === 0) return false;

        for (let i = 0; i < coordsList.length; i++) {
            if (inst.resolved) return false;

            // FAST-FAIL: se a proxy está congelada, aborta
            if (this._checkProxyStalled(inst, 20000, 'Esperando coordenada')) {
                this._handleProxyFailure(inst.id, inst, 'click_stall');
                return false;
            }

            const coords = coordsList[i];
            inst.currentCoordIndex = i;
            inst.lastAdClickCoords = coords;
            inst._lastActionTime = Date.now();
            this._broadcastStatus();

            this.log(null, 'info', `🎯 Tentativa ${i + 1}/${coordsList.length} — (${coords.x}, ${coords.y}) [${coords.label}]`);

            const result = await this._nativeClick(win, coords);
            inst._lastActionTime = Date.now();
            if (!result.ok) continue;

            if (inst.lastPopupUrl && (Date.now() - inst.lastPopupTime) < 10000) {
                this.log(null, 'success', `✅ Popup aberto pelo anuncio: ${inst.lastPopupUrl.substring(0, 60)}`);
                inst.finalUrl = inst.lastPopupUrl;
                return 'popup';
            }

            const openedUrl = await this._readOpenedUrl(win);
            if (openedUrl && !isSupportedHost(openedUrl)) {
                this.log(null, 'success', `✅ window.open capturou: ${openedUrl.substring(0, 60)}`);
                inst.finalUrl = openedUrl;
                return 'opened';
            }

            const currentUrl = win.webContents.getURL();
            if (!isSupportedHost(currentUrl) && currentUrl !== 'about:blank') {
                this.log(null, 'success', `✅ Navegou para: ${currentUrl.substring(0, 60)}`);
                return 'navigated';
            }

            await this._sleep(randomInt(500, 1000));
        }

        return false;
    }

    async _generateAdClickCoords(win) {
        try {
            const coords = await win.webContents.executeJavaScript(`
                (function(){
                    const coords = [];
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const scrollX = window.scrollX;
                    const scrollY = window.scrollY;

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
                            const absLeft = rect.left + scrollX;
                            const absTop = rect.top + scrollY;
                            coords.push({
                                x: Math.round(absLeft + rect.width / 2),
                                y: Math.round(absTop + rect.height / 2),
                                label: 'iframe-center',
                                source: 'iframe'
                            });
                            const cols = 3, rows = 2;
                            for (let r = 0; r < rows; r++) {
                                for (let c = 0; c < cols; c++) {
                                    coords.push({
                                        x: Math.round(absLeft + rect.width * (c + 0.5) / cols),
                                        y: Math.round(absTop + rect.height * (r + 0.5) / rows),
                                        label: 'iframe-grid-' + r + '-' + c,
                                        source: 'iframe-grid'
                                    });
                                }
                            }
                        }
                    }

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
                                x: Math.round(rect.left + scrollX + rect.width / 2),
                                y: Math.round(rect.top + scrollY + rect.height / 2),
                                label: 'ad-container-center',
                                source: 'ad-container'
                            });
                        }
                    }

                    const baseX = scrollX;
                    const baseY = scrollY;
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h / 2), label: 'screen-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h * 0.10), label: 'top-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.25), y: Math.round(baseY + h * 0.10), label: 'top-left', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.75), y: Math.round(baseY + h * 0.10), label: 'top-right', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h * 0.22), label: 'upper-mid-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.30), y: Math.round(baseY + h * 0.22), label: 'upper-mid-left', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.70), y: Math.round(baseY + h * 0.22), label: 'upper-mid-right', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h * 0.38), label: 'mid-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.30), y: Math.round(baseY + h * 0.38), label: 'mid-left', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.70), y: Math.round(baseY + h * 0.38), label: 'mid-right', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h * 0.55), label: 'lower-mid-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.30), y: Math.round(baseY + h * 0.55), label: 'lower-mid-left', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.70), y: Math.round(baseY + h * 0.55), label: 'lower-mid-right', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w / 2), y: Math.round(baseY + h * 0.72), label: 'lower-center', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.30), y: Math.round(baseY + h * 0.72), label: 'lower-left', source: 'generic' });
                    coords.push({ x: Math.round(baseX + w * 0.70), y: Math.round(baseY + h * 0.72), label: 'lower-right', source: 'generic' });

                    return coords;
                })()
            `);
            return coords;
        } catch (e) {
            this.log(null, 'warn', 'Erro ao gerar coordenadas: ' + e.message);
            return [];
        }
    }

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

    async _readOpenedUrl(win) {
        try {
            return await win.webContents.executeJavaScript(`
                (function(){
                    try {
                        if (window.__gs_lastOpenedUrl && (Date.now() - window.__gs_lastOpenTime) < 15000) {
                            return window.__gs_lastOpenedUrl;
                        }
                        return null;
                    } catch(e) { return null; }
                })()
            `);
        } catch (e) { return null; }
    }

    async _checkReachedFinalUrl(win, expectedFinalUrl) {
        try {
            const currentUrl = win.webContents.getURL();
            if (!currentUrl || currentUrl === 'about:blank') return false;

            if (expectedFinalUrl) {
                const normCurrent = currentUrl.replace(/\/$/, '').toLowerCase();
                const normExpected = expectedFinalUrl.replace(/\/$/, '').toLowerCase();

                if (normCurrent === normExpected || normCurrent.includes(normExpected) || normExpected.includes(normCurrent)) {
                    return true;
                }
                try {
                    const currentHost = new URL(currentUrl).hostname.toLowerCase();
                    const finalHost = new URL(expectedFinalUrl).hostname.toLowerCase();
                    if (currentHost === finalHost || currentHost.endsWith('.' + finalHost) || finalHost.endsWith('.' + currentHost)) {
                        return true;
                    }
                } catch (e) {}
            }

            if (!isSupportedHost(currentUrl)) {
                return true;
            }

            return false;
        } catch (e) { return false; }
    }

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
            if (this.running && !inst.window.isDestroyed()) {
                this._runCycle(id, { ...this.configStore.getAll(), links: this.configStore.get('links', []) }, inst.window, inst.session, inst.proxy);
            }
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
        inst.lastPopupUrl = null;
        inst.lastPopupTime = 0;
        inst._proxyFailed = false;
        inst._cycleStartTime = Date.now();
        inst._lastActionTime = Date.now();
        this._broadcastStatus();

        const scheduler = new Scheduler(config, this.configStore);

        if (scheduler.shouldTakeBreak(inst.cycle)) {
            const bt = scheduler.getBreakDuration();
            this.log(id, 'info', `Pausa ${(bt / 1000).toFixed(0)}s`);
            inst.status = 'break';
            this._broadcastStatus();
            await this._sleep(bt);
        }

        // Troca proxy se necessário
        if (isRetry || inst._proxyFailed || !currentProxy) {
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

        // ============================================================
        // NAVEGACAO COM FAST-FAIL: se demorar mais de 15s, proxy ruim
        // ============================================================
        let navFail = false;
        let navError = null;
        const navStart = Date.now();

        const navPromise = win.loadURL(link, { userAgent: inst.fingerprint.userAgent });
        const navTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('NAV_TIMEOUT')), 15000);
        });

        try {
            await Promise.race([navPromise, navTimeoutPromise]);
        } catch (e) {
            navFail = true;
            navError = e.message;
            this.log(id, 'error', `Navegacao: ${e.message}`);
        }

        // Se demorou demais mas não deu erro explícito, ainda pode ser proxy ruim
        const navElapsed = Date.now() - navStart;
        if (!navFail && navElapsed > 12000) {
            this.log(id, 'warn', `⏱ Navegacao demorou ${navElapsed}ms — possivel proxy lenta`);
        }

        if (navFail && navError && (
            navError.includes('ERR_PROXY_CONNECTION_FAILED') ||
            navError.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
            navError.includes('ERR_CERT') ||
            navError.includes('TIMEOUT') ||
            navError.includes('ETIMEDOUT') ||
            navError.includes('NAV_TIMEOUT')
        )) {
            this.log(id, 'warn', `🔄 Erro de proxy detectado — trocando e tentando novamente...`);
            inst._proxyFailed = true;
            if (currentProxy) this.proxyManager.addStrike(currentProxy);
            this.stats.failCount++;
            this._recordFail(link);
            inst.timeoutId = setTimeout(() => {
                if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, null, true);
            }, 2000);
            return;
        }

        if (navFail) {
            this.stats.failCount++;
            this._recordFail(link);
            this._broadcastStatus();
            inst.timeoutId = setTimeout(() => {
                if (this.running && !win.isDestroyed()) this._runCycle(id, config, win, sess, currentProxy, true);
            }, scheduler.getNextDelay() + 3000);
            return;
        }

        inst._lastActionTime = Date.now();
        await this._injectBypass(win);

        const startTime = Date.now();
        const TIMEOUT_MS = 90000;

        const doPoll = async () => {
            if (inst.resolved || !this.running || win.isDestroyed()) return;

            // FAST-FAIL: se o poll inteiro está congelado por mais de 20s
            if (this._checkProxyStalled(inst, 20000, 'Poll congelado')) {
                this._handleProxyFailure(id, inst, 'poll_stall');
                return;
            }

            const url = await this._readCurrentUrl(win);
            if (inst.resolved) return;

            const pagePhase = await this._detectPhaseFromPage(win);
            if (pagePhase && !inst.resolved) {
                inst.phase = { current: pagePhase.current, total: pagePhase.total, text: pagePhase.text };
                this._broadcastStatus();
            }

            const expectedFinalUrl = await this._readFinalUrl(win);
            if (expectedFinalUrl && !inst.finalUrl) {
                inst.finalUrl = expectedFinalUrl;
                this.log(id, 'info', `📌 URL final esperada: ${expectedFinalUrl.substring(0, 60)}`);
                this._broadcastStatus();
            }

            const openedUrl = await this._readOpenedUrl(win);
            if (openedUrl && !inst.finalUrl) {
                inst.finalUrl = openedUrl;
                this.log(id, 'info', `📌 URL capturada (window.open): ${openedUrl.substring(0, 60)}`);
                this._broadcastStatus();
            }

            if (inst.lastPopupUrl && (Date.now() - inst.lastPopupTime) < 12000 && !inst.finalUrl) {
                inst.finalUrl = inst.lastPopupUrl;
                this.log(id, 'info', `📌 URL capturada (popup): ${inst.lastPopupUrl.substring(0, 60)}`);
                this._broadcastStatus();
            }

            const reachedFinal = await this._checkReachedFinalUrl(win, inst.finalUrl);
            if (reachedFinal && !inst.resolved) {
                this._resolveSuccess(id, inst, link, url, scheduler);
                return;
            }

            // TENTA CLICAR NO ANUNCIO
            if (inst.adClickAttempts < inst.maxAdClickAttempts && !inst.resolved) {
                inst.adClickAttempts++;
                inst._lastActionTime = Date.now();

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
                    inst._lastActionTime = Date.now();

                    if (result === 'popup' && inst.finalUrl && !inst.resolved) {
                        this._resolveSuccess(id, inst, link, inst.finalUrl, scheduler);
                        return;
                    }

                    if (result === 'opened' && inst.finalUrl && !inst.resolved) {
                        const reached = await this._checkReachedFinalUrl(win, inst.finalUrl);
                        if (reached) {
                            this._resolveSuccess(id, inst, link, inst.finalUrl, scheduler);
                            return;
                        }
                    }

                    if (result === 'navigated' && !inst.resolved) {
                        const currentUrl = win.webContents.getURL();
                        const reached = await this._checkReachedFinalUrl(win, inst.finalUrl);
                        if (reached) {
                            this._resolveSuccess(id, inst, link, currentUrl, scheduler);
                            return;
                        }
                    }

                    if (!inst.resolved) {
                        this.log(id, 'info', `⏳ Coordenada nao abriu destino. Tentando proxima...`);
                    }
                }
            }

            // TIMEOUT normal (só chega aqui se não deu fast-fail)
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
                proxy: inst.proxy ? this._formatLocation(inst.proxy) : 'Sem proxy ⚠',
                proxyUrl: inst.proxy ? inst.proxy.url : null,
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