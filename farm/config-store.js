const fs = require('fs');
const path = require('path');

class ConfigStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.defaults = {
            links: [],
            proxies: [],
            instances: 3,
            minDelay: 5000,
            maxDelay: 15000,
            viewTime: 4000,
            peakHours: [5, 3, 2, 2, 3, 5, 10, 25, 55, 80, 90, 85, 75, 70, 75, 80, 85, 90, 95, 100, 85, 60, 30, 15],
            useProxies: true,
            proxyTimeout: 8000,
            randomizeUA: true,
            clearStorage: true,
            spoofReferrer: true,
            headless: false,
            autoStart: false,
            maxRetries: 3,
            concurrency: 2,
            logs: [],
            // v2
            earningsPerBypass: 0.05,
            dailyGoal: { enabled: false, amount: 50, currency: 'BRL' },
            linkStats: {},
            dailyStats: {},
            totalSuccess: 0,
            totalFail: 0,
            // v2.1
            profiles: {},
            stealthMode: false,
            webhook: { enabled: false, type: 'discord', url: '', botToken: '', chatId: '' },
            blacklist: { enabled: true, maxFails: 5, cooldownMinutes: 30 },
            linkCooldown: { enabled: true, minutes: 10 },
            pausedLinks: {},
            linkLastUsed: {}
        };
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(raw);
                return this._deepMerge({ ...this.defaults }, parsed);
            }
        } catch (e) {
            console.error('[ConfigStore] Erro ao carregar:', e.message);
        }
        return { ...this.defaults };
    }

    _deepMerge(target, source) {
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                this._deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (e) {
            console.error('[ConfigStore] Erro ao salvar:', e.message);
        }
    }

    get(key, fallback) {
        return this.data[key] !== undefined ? this.data[key] : fallback;
    }

    set(key, value) {
        this.data[key] = value;
        this.save();
    }

    merge(obj) {
        this.data = this._deepMerge(this.data, obj);
        this.save();
    }

    getAll() {
        return JSON.parse(JSON.stringify(this.data));
    }

    pushLog(entry) {
        if (!this.data.logs) this.data.logs = [];
        this.data.logs.unshift({ time: new Date().toISOString(), ...entry });
        if (this.data.logs.length > 500) this.data.logs = this.data.logs.slice(0, 500);
        this.save();
    }

    clearLogs() {
        this.data.logs = [];
        this.save();
    }
}

module.exports = ConfigStore;

