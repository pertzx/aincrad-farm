const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROXY_LIST_URL = 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt';

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
    constructor(timeout = 8000) {
        this.timeout = timeout;
        this.geoCache = new Map();
        this.proxies = [];
        this.lastFetch = 0;
        this.isScanning = false;
        this.scanTimer = null;
        this.continuousScan = true; // NOVO
    }

    startScanner() {
        if (this.isScanning) return;
        this.isScanning = true;
        this._scanLoop();
    }

    stopScanner() {
        this.isScanning = false;
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    }

    async _scanLoop() {
        if (!this.isScanning) return;
        try {
            await this._doScan();
        } catch (e) {
            console.error('[ProxyManager] Scan error:', e.message);
        }
        // Espera 30s e recomeça do zero (pega proxies novas, retesta todas)
        this.scanTimer = setTimeout(() => this._scanLoop(), 30000);
    }

    async _doScan() {
        const raw = await this.fetchRaw();
        const all = this.parseList(raw);
        const candidates = all.filter(p => ['http', 'https', 'socks5'].includes(p.protocol));
        console.log(`[ProxyManager] ${candidates.length} proxies para testar...`);

        // Limpa lista antiga no início de cada scan completo
        this.proxies = [];
        this._broadcast('proxy:updated', []);

        // Testa em lotes de 10 (não bloqueia a UI, mas processa todas)
        const BATCH_SIZE = 10;
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(p => this.testProxy(p)));

            // Adiciona as que funcionaram imediatamente
            const working = results.filter(p => p.working);
            if (working.length > 0) {
                this.proxies.push(...working);
                // Reordena por ping
                this.proxies.sort((a, b) => a.ping - b.ping);
                console.log(`[ProxyManager] +${working.length} OK (${this.proxies.length} total)`);
                this._broadcast('proxy:updated', this.proxies);
            }
        }

        this.lastFetch = Date.now();
        console.log(`[ProxyManager] Scan completo: ${this.proxies.length} proxies OK de ${candidates.length}`);
        return this.proxies;
    }

    async healthCheckAll() {
        if (this.proxies.length === 0) return [];
        console.log(`[ProxyManager] Health check em ${this.proxies.length} proxies...`);

        const BATCH_SIZE = 10;
        const stillWorking = [];

        for (let i = 0; i < this.proxies.length; i += BATCH_SIZE) {
            const batch = this.proxies.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map(p => this.testProxy({ ...p })));
            const ok = results.filter(p => p.working);
            stillWorking.push(...ok);

            // Atualiza lista parcial imediatamente
            this.proxies = stillWorking.concat(this.proxies.slice(i + BATCH_SIZE));
            this.proxies.sort((a, b) => a.ping - b.ping);
            this._broadcast('proxy:updated', this.proxies);
        }

        this.proxies = stillWorking.sort((a, b) => a.ping - b.ping);
        console.log(`[ProxyManager] Health check: ${this.proxies.length} proxies ainda OK`);
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

    async testProxy(proxy) {
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
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        proxy.working = true;
                        proxy.alive = true;
                        proxy.origin = json.origin;
                        proxy.ping = Date.now() - start;
                        proxy.geo = await this.getGeo(proxy.ip);
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

    _broadcast(channel, data) {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send(channel, data);
        });
    }

    getProxies() {
        return this.proxies;
    }

    pickWeighted() {
        if (this.proxies.length === 0) return null;
        const byTier = { 1: [], 2: [], 3: [], 4: [] };
        this.proxies.forEach(p => { byTier[p.tier] = byTier[p.tier] || []; byTier[p.tier].push(p); });
        const roll = Math.random();
        let pool = [];
        if (roll < 0.70 && byTier[1].length) pool = byTier[1];
        else if (roll < 0.90 && byTier[2].length) pool = byTier[2];
        else if (roll < 0.98 && byTier[3].length) pool = byTier[3];
        else if (byTier[4].length) pool = byTier[4];
        else pool = this.proxies;
        return pool[Math.floor(Math.random() * pool.length)];
    }
}

module.exports = ProxyManager;

