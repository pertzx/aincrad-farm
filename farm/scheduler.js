const { randomInt } = require('./fingerprint');

class Scheduler {
    constructor(config) {
        this.config = config || {};
    }

    isPeakHour() {
        const now = new Date();
        const current = now.getHours() * 60 + now.getMinutes();
        const peaks = this.config.peakHours || [];
        for (const peak of peaks) {
            const [sh, sm] = (peak.start || '00:00').split(':').map(Number);
            const [eh, em] = (peak.end || '00:00').split(':').map(Number);
            const start = sh * 60 + sm;
            const end = eh * 60 + em;
            if (current >= start && current <= end) return true;
        }
        return false;
    }

    getTimeWeight() {
        const peaks = this.config.peakHours || [];
        if (peaks.length === 0) return 1.0;
        return this.isPeakHour() ? 0.7 : 1.3;
    }

    pickNextLink(links, tierList) {
        if (!links || links.length === 0) return null;
        if (!tierList || tierList.length === 0) {
            return links[randomInt(0, links.length - 1)];
        }
        // Mapeia links para pesos baseados em tierList
        const weighted = links.map(link => {
            // Encontra tier que matcha o link (ou wildcard *)
            const tier = tierList.find(t => {
                if (!t.url) return false;
                if (t.url === '*') return true;
                return link.includes(t.url);
            });
            const weight = tier ? (parseFloat(tier.weight) || 1.0) : 1.0;
            return { link, weight };
        });
        const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
        let random = Math.random() * totalWeight;
        for (const item of weighted) {
            random -= item.weight;
            if (random <= 0) return item.link;
        }
        return weighted[weighted.length - 1].link;
    }

    getNextDelay() {
        const min = parseInt(this.config.minDelay, 10) || 3000;
        const max = parseInt(this.config.maxDelay, 10) || 12000;
        const weight = this.getTimeWeight();
        const base = randomInt(min, max);
        return Math.max(1000, Math.round(base * weight));
    }

    getViewTime() {
        const base = parseInt(this.config.viewTime, 10) || 4000;
        const variance = randomInt(-1000, 2000);
        return Math.max(2000, base + variance);
    }

    shouldTakeBreak(cycleCount) {
        const threshold = randomInt(8, 15);
        return cycleCount > 0 && cycleCount % threshold === 0;
    }

    getBreakDuration() {
        return randomInt(30000, 120000);
    }
}

module.exports = Scheduler;