
const { randomInt } = require('./fingerprint');

class Scheduler {
    constructor(config, configStore) {
        this.config = config;
        this.configStore = configStore;
    }

    pickNextLink(links) {
        if (!links || links.length === 0) return '';
        if (links.length === 1) {
            const first = links[0];
            return typeof first === 'string' ? first : first.url;
        }

        // Filtra links em cooldown ou na blacklist
        const now = Date.now();
        const blacklist = this.configStore ? this.configStore.get('pausedLinks', {}) : {};
        const lastUsed = this.configStore ? this.configStore.get('linkLastUsed', {}) : {};
        const cooldownCfg = this.config.linkCooldown || { enabled: true, minutes: 10 };
        const blacklistCfg = this.config.blacklist || { enabled: true, maxFails: 5, cooldownMinutes: 30 };
        
        const available = links.filter(l => {
            const url = typeof l === 'string' ? l : l.url;
            
            // Check blacklist
            if (blacklistCfg.enabled && blacklist[url]) {
                const paused = blacklist[url];
                const resumeAt = paused.pausedAt + (blacklistCfg.cooldownMinutes * 60 * 1000);
                if (now < resumeAt) return false;
            }
            
            // Check cooldown
            if (cooldownCfg.enabled && lastUsed[url]) {
                const nextUse = lastUsed[url] + (cooldownCfg.minutes * 60 * 1000);
                if (now < nextUse) return false;
            }
            
            return true;
        });

        // Se todos estão em cooldown/blacklist, ignora filtros e pega qualquer um
        const pool = available.length > 0 ? available : links;

        const weights = pool.map(l => typeof l === 'object' ? (l.weight || 1) : 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        
        let random = Math.random() * totalWeight;
        for (let i = 0; i < pool.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                const link = pool[i];
                return typeof link === 'string' ? link : link.url;
            }
        }
        const last = pool[pool.length - 1];
        return typeof last === 'string' ? last : last.url;
    }

    getNextDelay() {
        const min = this.config.minDelay || 5000;
        const max = this.config.maxDelay || 15000;
        const peakHours = this.config.peakHours || Array(24).fill(50);
        const hour = new Date().getHours();
        const intensity = peakHours[hour] || 50;
        const factor = 1 - (intensity / 100);
        const delay = min + (max - min) * factor;
        return Math.round(delay + randomInt(-500, 500));
    }

    getViewTime() {
        return (this.config.viewTime || 4000) + randomInt(-500, 1000);
    }

    shouldTakeBreak(cycle) {
        return cycle > 0 && cycle % randomInt(8, 15) === 0;
    }

    getBreakDuration() {
        const peakHours = this.config.peakHours || Array(24).fill(50);
        const hour = new Date().getHours();
        const intensity = peakHours[hour] || 50;
        return intensity > 70 ? randomInt(3000, 8000) :
               intensity > 40 ? randomInt(8000, 15000) :
               randomInt(15000, 30000);
    }
}

module.exports = Scheduler;