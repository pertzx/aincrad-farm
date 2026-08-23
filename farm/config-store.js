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
            peakHours: [
                { start: '09:00', end: '12:00', weight: 1.5 },
                { start: '14:00', end: '18:00', weight: 1.2 },
                { start: '20:00', end: '23:30', weight: 1.0 }
            ],
            tierList: [
                { url: '', weight: 1.0 }
            ],
            useProxies: true,
            proxyTimeout: 8000,
            randomizeUA: true,
            clearStorage: true,
            spoofReferrer: true,
            headless: false,
            autoStart: false,
            maxRetries: 3,
            concurrency: 2,
            logs: []
        };
        this.data = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                return { ...this.defaults, ...JSON.parse(raw) };
            }
        } catch (e) {
            console.error('[ConfigStore] Erro ao carregar:', e.message);
        }
        return { ...this.defaults };
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
        this.data = { ...this.data, ...obj };
        this.save();
    }

    getAll() {
        return { ...this.data };
    }

    pushLog(entry) {
        if (!this.data.logs) this.data.logs = [];
        this.data.logs.unshift({
            time: new Date().toISOString(),
            ...entry
        });
        if (this.data.logs.length > 500) this.data.logs = this.data.logs.slice(0, 500);
        this.save();
    }

    clearLogs() {
        this.data.logs = [];
        this.save();
    }
}

module.exports = ConfigStore;
