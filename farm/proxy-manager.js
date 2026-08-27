const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROXY_LIST_URL = 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt';
const TOP_POOL_SIZE = 10;
const STRIKE_MAX = 3;
const STRIKE_COOLDOWN_MS = 5 * 60 * 1000;
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000;
const HEALTH_CHECK_TIMEOUT = 3000;

const PROXY_MALICIOUS_KEYWORDS = [
    'access denied', 'blocked', 'banned', 'forbidden', 'unauthorized',
    'captcha', 'recaptcha', 'hcaptcha', 'turnstile',
    'proxy detected', 'proxy ban', 'vpn detected', 'vpn ban',
    'suspicious activity', 'automated access', 'bot detected',
    'please wait', 'checking your browser', 'ddos protection',
    'cloudflare', 'incapsula', 'sucuri', 'akamai',
    'rate limit', 'too many requests', '429',
    'security check', 'verification required',
    'your ip has been blocked', 'ip blocked',
    'this proxy is', 'free proxy', 'public proxy',
    'advertisement', 'sponsored', 'ad served by',
    'redirecting', 'click here to continue',
    'warning', 'alert', 'notice', 'attention required',
    // >>> PROXY DEBUG/ECHO <<<
    'REMOTE_ADDR', 'REMOTE_PORT', 'REQUEST_METHOD', 'REQUEST_URI',
    'REQUEST_TIME', 'HTTP_HOST', 'HTTP_USER_AGENT', 'HTTP_ACCEPT',
    'HTTP_REFERER', 'HTTP_CONNECTION', 'HTTP_ACCEPT_ENCODING',
    'HTTP_ACCEPT_LANGUAGE', 'HTTP_SEC_FETCH', 'HTTP_UPGRADE_INSECURE_REQUESTS',
    'HTTP_PRIORITY'
];

function countryCodeToEmoji(code) {
    if (!code || code.length !== 2) return '🌐';
    const A = 0x1F1E6;
    return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

function httpGet(url, options = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const client = u.protocol === 'https:' ? https : http;
        const req = client.get(url, { ...options, timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

class ProxyManager {
    constructor(configStore, timeout = 8000) {
        this.configStore = configStore;
        this.timeout = timeout;
        this.geoCache = new Map();
        this.proxies = [];
        this.topPool = [];
        this.strikes = new Map();
        this.blacklist = new Set();
        this.blacklistReasons = new Map();
        this.lastFetch = 0;
        this.isScanning = false;
        this.scanTimer = null;
        this.healthTimer = null;
        this.continuousScan = true;
        this._geoQueue = [];
        this._geoRunning = false;

        this._loadSavedProxies();
        this._loadBlacklist();
        this._rebuildTopPool();
    }

    _proxyKey(p) {
        return `${p.protocol}://${p.ip}:${p.port}`;
    }

    _loadSavedProxies() {
        const saved = this.configStore.get('proxies', []);
        if (saved && saved.length > 0) {
            const now = Date.now();
            const fresh = saved.filter(p => p.lastTested && (now - p.lastTested) < 24 * 60 * 60 * 1000);
            this.proxies = fresh;
            console.log(`[ProxyManager] ${fresh.length} proxies carregadas do cache`);
        }
        const savedStrikes = this.configStore.get('proxyStrikes', {});
        for (const [key, val] of Object.entries(savedStrikes)) {
            this.strikes.set(key, val);
        }
    }

    _loadBlacklist() {
        const saved = this.configStore.get('proxyBlacklist', []);
        const savedReasons = this.configStore.get('proxyBlacklistReasons', {});
        for (const key of saved) this.blacklist.add(key);
        for (const [key, val] of Object.entries(savedReasons)) {
            this.blacklistReasons.set(key, val);
        }
        console.log(`[ProxyManager] ${this.blacklist.size} proxies na blacklist carregadas`);
    }

    _saveProxies() {
        this.configStore.set('proxies', this.proxies.map(p => ({
            ...p,
            lastTested: p.lastTested || Date.now()
        })));
        const strikesObj = {};
        for (const [key, val] of this.strikes) strikesObj[key] = val;
        this.configStore.set('proxyStrikes', strikesObj);
    }

    _saveBlacklist() {
        const arr = Array.from(this.blacklist);
        const reasonsObj = {};
        for (const [key, val] of this.blacklistReasons) {
            reasonsObj[key] = val;
        }
        this.configStore.set('proxyBlacklist', arr);
        this.configStore.set('proxyBlacklistReasons', reasonsObj);
        // Força escrita no disco
        if (this.configStore._saveSync) {
            try { this.configStore._saveSync(); } catch (e) { }
        }
        console.log(`[ProxyManager] Blacklist salva: ${arr.length} proxies`);
    }

    blacklistProxy(proxy, reason = 'manual') {
        const key = this._proxyKey(proxy);
        if (this.blacklist.has(key)) return false;

        this.blacklist.add(key);
        this.blacklistReasons.set(key, {
            reason,
            timestamp: Date.now(),
            ip: proxy.ip,
            port: proxy.port,
            protocol: proxy.protocol
        });

        this.proxies = this.proxies.filter(p => this._proxyKey(p) !== key);
        this.topPool = this.topPool.filter(p => this._proxyKey(p) !== key);

        console.log(`[ProxyManager] ⛔ PROXY BLACKLISTED: ${key} | Motivo: ${reason}`);
        this._saveBlacklist();
        this._saveProxies();
        this._broadcast('proxy:updated', this.proxies);
        this._broadcast('proxy:blacklist-updated', this.getBlacklist());
        return true;
    }

    unblacklistProxy(proxy) {
        const key = this._proxyKey(proxy);
        if (!this.blacklist.has(key)) return false;

        this.blacklist.delete(key);
        this.blacklistReasons.delete(key);
        this.strikes.delete(key);

        console.log(`[ProxyManager] ✅ PROXY UNBLACKLISTED: ${key}`);
        this._saveBlacklist();
        this._broadcast('proxy:blacklist-updated', this.getBlacklist());
        return true;
    }

    isBlacklisted(proxy) {
        return this.blacklist.has(this._proxyKey(proxy));
    }

    getBlacklist() {
        const result = [];
        for (const key of this.blacklist) {
            const reason = this.blacklistReasons.get(key);
            result.push({
                key,
                ip: reason?.ip,
                port: reason?.port,
                protocol: reason?.protocol,
                reason: reason?.reason || 'unknown',
                timestamp: reason?.timestamp || 0,
                date: reason ? new Date(reason.timestamp).toLocaleString('pt-BR') : '?'
            });
        }
        return result.sort((a, b) => b.timestamp - a.timestamp);
    }

    _isResponseTampered(data) {
        if (!data || typeof data !== 'string') return { tampered: true, reason: 'empty_response' };

        const lower = data.toLowerCase();

        try {
            const json = JSON.parse(data);
            if (json.origin && typeof json.origin === 'string') {
                return { tampered: false, reason: null };
            }
        } catch (e) { }

        for (const keyword of PROXY_MALICIOUS_KEYWORDS) {
            if (lower.includes(keyword)) {
                return { tampered: true, reason: `keyword_detected: ${keyword}` };
            }
        }

        if (data.length < 10) return { tampered: true, reason: 'response_too_short' };
        if (data.length > 5000 && !data.trim().startsWith('{')) {
            return { tampered: true, reason: 'unexpected_html_response' };
        }

        return { tampered: false, reason: null };
    }

    _rebuildTopPool() {
        const now = Date.now();

        for (const [key, val] of this.strikes) {
            if (now - val.lastStrike > STRIKE_COOLDOWN_MS) {
                this.strikes.delete(key);
            }
        }

        const available = this.proxies.filter(p => {
            const key = this._proxyKey(p);
            if (this.blacklist.has(key)) return false;

            const s = this.strikes.get(key);
            if (!s) return true;
            if (now - s.lastStrike > STRIKE_COOLDOWN_MS) {
                this.strikes.delete(key);
                return true;
            }
            return s.count < STRIKE_MAX;
        });

        this.topPool = available
            .sort((a, b) => a.ping - b.ping)
            .slice(0, TOP_POOL_SIZE);

        console.log(`[ProxyManager] Top pool: ${this.topPool.length}/${TOP_POOL_SIZE} proxies`);
        this._broadcast('proxy:top-updated', this.topPool);
    }

    addStrike(proxy, reason = 'generic') {
        const key = this._proxyKey(proxy);
        const now = Date.now();
        const existing = this.strikes.get(key);

        if (existing && now - existing.lastStrike > STRIKE_COOLDOWN_MS) {
            this.strikes.set(key, { count: 1, lastStrike: now, reasons: [reason] });
        } else if (existing) {
            existing.count++;
            existing.lastStrike = now;
            if (!existing.reasons) existing.reasons = [];
            existing.reasons.push(reason);
        } else {
            this.strikes.set(key, { count: 1, lastStrike: now, reasons: [reason] });
        }

        const current = this.strikes.get(key);
        console.log(`[ProxyManager] Strike ${current.count}/${STRIKE_MAX} em ${key} (${reason})`);

        if (current.count >= STRIKE_MAX) {
            console.log(`[ProxyManager] ⛔ ${key} removida do top pool por ${STRIKE_COOLDOWN_MS / 60000}min`);
        }

        this._saveProxies();
        this._rebuildTopPool();
    }

    startScanner() {
        if (this.isScanning) return;
        this.isScanning = true;
        this._scanLoop();
        this._startHealthCheck();
    }

    stopScanner() {
        this.isScanning = false;
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
        if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null; }
    }

    _startHealthCheck() {
        if (this.healthTimer) clearInterval(this.healthTimer);
        this.healthTimer = setInterval(async () => {
            if (!this.isScanning || this.topPool.length === 0) return;
            console.log(`[ProxyManager] Health check top ${this.topPool.length}...`);

            const results = await Promise.all(
                this.topPool.map(p => this._pingProxy(p, HEALTH_CHECK_TIMEOUT))
            );

            const dead = [];
            for (let i = 0; i < results.length; i++) {
                if (!results[i].ok) {
                    dead.push(this.topPool[i]);
                    this.addStrike(this.topPool[i], 'health_check_fail');
                } else {
                    this.topPool[i].ping = results[i].ping;
                }
            }

            if (dead.length > 0) {
                console.log(`[ProxyManager] ${dead.length} proxies do top pool morreram`);
                this._rebuildTopPool();
                this._broadcast('proxy:updated', this.proxies);
            }
        }, HEALTH_CHECK_INTERVAL_MS);
    }

    _pingProxy(proxy, customTimeout) {
        const start = Date.now();
        return new Promise((resolve) => {
            const options = {
                hostname: proxy.ip, port: proxy.port,
                path: 'http://httpbin.org/ip',
                method: 'GET', timeout: customTimeout || 3000,
                headers: { Host: 'httpbin.org', 'User-Agent': 'Mozilla/5.0' }
            };
            const client = proxy.protocol === 'https' || proxy.protocol === 'socks5' ? https : http;
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const tamperCheck = this._isResponseTampered(data);
                        if (tamperCheck.tampered) {
                            console.log(`[ProxyManager] 🚨 Proxy ${proxy.ip}:${proxy.port} modificou resposta: ${tamperCheck.reason}`);
                            this.blacklistProxy(proxy, `tampered_ping: ${tamperCheck.reason}`);
                            resolve({ ok: false, tampered: true, reason: tamperCheck.reason });
                            return;
                        }
                        JSON.parse(data);
                        resolve({ ok: true, ping: Date.now() - start });
                    } catch {
                        resolve({ ok: false });
                    }
                });
            });
            req.on('error', () => resolve({ ok: false }));
            req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
            req.end();
        });
    }

    async _scanLoop() {
        if (!this.isScanning) return;
        try {
            await this._doScan();
        } catch (e) {
            console.error('[ProxyManager] Scan error:', e.message);
        }
        this.scanTimer = setTimeout(() => this._scanLoop(), 30000);
    }

    async _doScan() {
        const raw = await this.fetchRaw();
        const all = this.parseList(raw);
        const candidates = all.filter(p => ['http', 'https', 'socks5'].includes(p.protocol));
        console.log(`[ProxyManager] ${candidates.length} proxies para testar...`);

        const existingMap = new Map(this.proxies.map(p => [this._proxyKey(p), p]));
        this.proxies.forEach(p => { p._needsRetest = true; });

        const BATCH_SIZE = 100;
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            if (!this.isScanning) break;
            const batch = candidates.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(p => this.testProxyFast(p)));

            const working = results.filter(p => p.working);
            if (working.length > 0) {
                for (const p of working) {
                    const key = this._proxyKey(p);
                    if (this.blacklist.has(key)) {
                        console.log(`[ProxyManager] Ignorando proxy blacklisted: ${key}`);
                        continue;
                    }

                    const existing = existingMap.get(key);
                    if (existing) {
                        existing.ping = p.ping;
                        existing.working = true;
                        existing.alive = true;
                        existing.origin = p.origin;
                        existing.lastTested = Date.now();
                        existing._needsRetest = false;
                        if (!existing.geo && p.geo) existing.geo = p.geo;
                    } else {
                        p.lastTested = Date.now();
                        this.proxies.push(p);
                        existingMap.set(key, p);
                    }
                    if (!p.geo) this._geoQueue.push(p);
                }

                this.proxies.sort((a, b) => a.ping - b.ping);
                console.log(`[ProxyManager] +${working.length} OK (${this.proxies.length} total)`);
                this._saveProxies();
            }
        }

        const beforeCount = this.proxies.length;
        this.proxies = this.proxies.filter(p => !p._needsRetest);
        this.proxies.forEach(p => delete p._needsRetest);

        if (beforeCount !== this.proxies.length) {
            console.log(`[ProxyManager] Removidas ${beforeCount - this.proxies.length} proxies mortas`);
        }

        this._rebuildTopPool();
        this._broadcast('proxy:updated', this.proxies);
        this._saveProxies();
        this._processGeoQueue();

        this.lastFetch = Date.now();
        console.log(`[ProxyManager] Scan completo: ${this.proxies.length} total, ${this.topPool.length} no top pool, ${this.blacklist.size} na blacklist`);
        return this.proxies;
    }

    async _processGeoQueue() {
        if (this._geoRunning) return;
        this._geoRunning = true;
        while (this._geoQueue.length > 0) {
            const p = this._geoQueue.shift();
            try {
                const geo = await this.getGeo(p.ip);
                if (geo) {
                    p.geo = geo;
                    this._broadcast('proxy:updated', this.proxies);
                    this._saveProxies();
                }
            } catch (e) {
                if (e.message && e.message.includes('rate')) {
                    this._geoQueue.unshift(p);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            await new Promise(r => setTimeout(r, 300));
        }
        this._geoRunning = false;
    }

    async healthCheckAll() {
        if (this.proxies.length === 0) return [];
        console.log(`[ProxyManager] Health check em ${this.proxies.length} proxies...`);

        const BATCH_SIZE = 100;
        const stillWorking = [];

        for (let i = 0; i < this.proxies.length; i += BATCH_SIZE) {
            const batch = this.proxies.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(p => this.testProxyFast({ ...p })));
            const ok = results.filter(p => p.working);
            stillWorking.push(...ok);

            for (const p of ok) {
                if (!p.geo) this._geoQueue.push(p);
            }

            this.proxies = stillWorking.concat(this.proxies.slice(i + BATCH_SIZE));
            this.proxies.sort((a, b) => a.ping - b.ping);
        }

        this.proxies = stillWorking.sort((a, b) => a.ping - b.ping);
        this._rebuildTopPool();
        this._broadcast('proxy:updated', this.proxies);
        this._saveProxies();
        console.log(`[ProxyManager] Health check: ${this.proxies.length} OK, top pool: ${this.topPool.length}`);
        return this.proxies;
    }

    async fetchRaw() {
        return new Promise((resolve, reject) => {
            const client = new URL(PROXY_LIST_URL).protocol === 'https:' ? https : http;
            const req = client.get(PROXY_LIST_URL, { timeout: 15000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
    }

    parseList(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const proxies = [];
        for (const line of lines) {
            let proto = 'http', hostPort = line;
            if (line.includes('://')) {
                const u = new URL(line);
                proto = u.protocol.replace(':', '');
                hostPort = u.host;
            }
            const [ip, port] = hostPort.split(':');
            if (ip && port && !isNaN(parseInt(port))) {
                proxies.push({ protocol: proto, ip, port: parseInt(port), url: `${proto}://${ip}:${port}` });
            }
        }
        return proxies;
    }

    async getGeo(ip) {
        if (this.geoCache.has(ip)) return this.geoCache.get(ip);
        try {
            const res = await httpGet(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,query`, {}, 5000);
            const json = JSON.parse(res.data);
            if (json.status === 'success') {
                const geo = {
                    country: json.country, countryCode: json.countryCode,
                    region: json.regionName, city: json.city, isp: json.isp,
                    flag: countryCodeToEmoji(json.countryCode)
                };
                this.geoCache.set(ip, geo);
                return geo;
            }
        } catch (e) { }
        return { country: 'Desconhecido', countryCode: '??', region: '', city: '', isp: '', flag: '🌐' };
    }

    async testProxyFast(proxy) {
        const start = Date.now();
        return new Promise((resolve) => {
            const options = {
                hostname: proxy.ip, port: proxy.port,
                path: 'http://httpbin.org/ip',
                method: 'GET', timeout: this.timeout,
                headers: { Host: 'httpbin.org', 'User-Agent': 'Mozilla/5.0' }
            };
            const client = proxy.protocol === 'https' || proxy.protocol === 'socks5' ? https : http;
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const tamperCheck = this._isResponseTampered(data);
                        if (tamperCheck.tampered) {
                            console.log(`[ProxyManager] 🚨 Proxy ${proxy.ip}:${proxy.port} modificou resposta no teste: ${tamperCheck.reason}`);
                            this.blacklistProxy(proxy, `tampered_test: ${tamperCheck.reason}`);
                            proxy.working = false;
                            proxy.alive = false;
                            proxy.tampered = true;
                            proxy.tamperReason = tamperCheck.reason;
                            resolve(proxy);
                            return;
                        }

                        const json = JSON.parse(data);
                        proxy.working = true;
                        proxy.alive = true;
                        proxy.origin = json.origin;
                        proxy.ping = Date.now() - start;
                        proxy.tampered = false;
                        if (proxy.ping < 1500) proxy.tier = 1;
                        else if (proxy.ping < 4000) proxy.tier = 2;
                        else if (proxy.ping < 8000) proxy.tier = 3;
                        else proxy.tier = 4;
                        resolve(proxy);
                    } catch {
                        proxy.working = false;
                        proxy.alive = false;
                        resolve(proxy);
                    }
                });
            });
            req.on('error', () => { proxy.working = false; proxy.alive = false; resolve(proxy); });
            req.on('timeout', () => { req.destroy(); proxy.working = false; proxy.alive = false; resolve(proxy); });
            req.end();
        });
    }

    async testProxy(proxy) {
        const result = await this.testProxyFast(proxy);
        if (result.working && !result.geo) {
            result.geo = await this.getGeo(proxy.ip);
        }
        return result;
    }

    _broadcast(channel, data) {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send(channel, data);
        });
    }

    getProxies() {
        return this.proxies;
    }

    getTopPool() {
        return this.topPool;
    }

    pickWeighted() {
        if (this.topPool.length === 0) {
            if (this.proxies.length === 0) return null;
            const fast = this.proxies
                .filter(p => !this.blacklist.has(this._proxyKey(p)))
                .sort((a, b) => a.ping - b.ping)
                .slice(0, TOP_POOL_SIZE);
            if (fast.length === 0) return null;
            return fast[Math.floor(Math.random() * fast.length)];
        }
        return this.topPool[Math.floor(Math.random() * this.topPool.length)];
    }
}

module.exports = ProxyManager;