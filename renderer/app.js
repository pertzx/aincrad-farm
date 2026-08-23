
// ============ TABS ============
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ============ ELEMENTS ============
const els = {
    start: document.getElementById('btn-start'),
    stop: document.getElementById('btn-stop'),
    saveCfg: document.getElementById('btn-save-cfg'),
    loadCfg: document.getElementById('btn-load-cfg'),
    refreshProxies: document.getElementById('btn-refresh-proxies'),
    clearLogs: document.getElementById('btn-clear-logs'),
    addTier: document.getElementById('btn-add-tier'),
    addPeak: document.getElementById('btn-add-peak'),
    tierContainer: document.getElementById('tier-container'),
    peakContainer: document.getElementById('peak-container'),
    statSuccess: document.getElementById('stat-success'),
    statFail: document.getElementById('stat-fail'),
    statRuns: document.getElementById('stat-runs'),
    statRate: document.getElementById('stat-rate'),
    statInstances: document.getElementById('stat-instances'),
    instancesList: document.getElementById('instances-list'),
    proxyList: document.getElementById('proxy-list'),
    proxyStats: document.getElementById('proxy-stats'),
    logsContainer: document.getElementById('logs-container'),
    globalStatus: document.getElementById('global-status'),
    uptime: document.getElementById('uptime'),
    cfg: {
        links: document.getElementById('cfg-links'),
        instances: document.getElementById('cfg-instances'),
        headless: document.getElementById('cfg-headless'),
        minDelay: document.getElementById('cfg-min-delay'),
        maxDelay: document.getElementById('cfg-max-delay'),
        viewTime: document.getElementById('cfg-view-time'),
        useProxies: document.getElementById('cfg-use-proxies'),
        randomUA: document.getElementById('cfg-random-ua'),
        clearStorage: document.getElementById('cfg-clear-storage'),
    }
};

// ============ TIER LIST UI ============
function renderTiers(tiers) {
    els.tierContainer.innerHTML = '';
    (tiers || []).forEach((t, idx) => {
        const row = document.createElement('div');
        row.className = 'tier-row';
        row.innerHTML = `
            <input type="text" class="tier-url" placeholder="URL ou *" value="${t.url || ''}">
            <input type="range" class="tier-weight" min="0.1" max="5" step="0.1" value="${t.weight || 1}">
            <span class="tier-weight-val">${(t.weight || 1).toFixed(1)}</span>
            <button class="btn-icon" data-idx="${idx}" title="Remover">🗑</button>
        `;
        row.querySelector('.tier-weight').addEventListener('input', (e) => {
            row.querySelector('.tier-weight-val').textContent = parseFloat(e.target.value).toFixed(1);
        });
        row.querySelector('.btn-icon').addEventListener('click', () => row.remove());
        els.tierContainer.appendChild(row);
    });
}
function getTiers() {
    return Array.from(els.tierContainer.querySelectorAll('.tier-row')).map(row => ({
        url: row.querySelector('.tier-url').value.trim(),
        weight: parseFloat(row.querySelector('.tier-weight').value) || 1
    })).filter(t => t.url);
}
els.addTier.addEventListener('click', () => {
    const current = getTiers(); current.push({ url: '', weight: 1 }); renderTiers(current);
});

// ============ PEAK HOURS UI ============
function renderPeaks(peaks) {
    els.peakContainer.innerHTML = '';
    (peaks || []).forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'peak-row';
        row.innerHTML = `
            <input type="time" class="peak-start" value="${p.start || '09:00'}">
            <span>até</span>
            <input type="time" class="peak-end" value="${p.end || '12:00'}">
            <input type="range" class="peak-weight" min="0.5" max="3" step="0.1" value="${p.weight || 1}">
            <span class="peak-weight-val">${(p.weight || 1).toFixed(1)}x</span>
            <button class="btn-icon" data-idx="${idx}" title="Remover">🗑</button>
        `;
        row.querySelector('.peak-weight').addEventListener('input', (e) => {
            row.querySelector('.peak-weight-val').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
        });
        row.querySelector('.btn-icon').addEventListener('click', () => row.remove());
        els.peakContainer.appendChild(row);
    });
}
function getPeaks() {
    return Array.from(els.peakContainer.querySelectorAll('.peak-row')).map(row => ({
        start: row.querySelector('.peak-start').value,
        end: row.querySelector('.peak-end').value,
        weight: parseFloat(row.querySelector('.peak-weight').value) || 1
    }));
}
els.addPeak.addEventListener('click', () => {
    const current = getPeaks(); current.push({ start: '09:00', end: '18:00', weight: 1.2 }); renderPeaks(current);
});

// ============ CONFIG READ/WRITE ============
function readConfig() {
    return {
        links: els.cfg.links.value.split('\n').map(l => l.trim()).filter(l => l),
        instances: parseInt(els.cfg.instances.value, 10) || 1,
        headless: els.cfg.headless.value === 'true',
        minDelay: parseInt(els.cfg.minDelay.value, 10) || 5000,
        maxDelay: parseInt(els.cfg.maxDelay.value, 10) || 15000,
        viewTime: parseInt(els.cfg.viewTime.value, 10) || 4000,
        useProxies: els.cfg.useProxies.value === 'true',
        randomizeUA: els.cfg.randomUA.value === 'true',
        clearStorage: els.cfg.clearStorage.value === 'true',
        tierList: getTiers(),
        peakHours: getPeaks()
    };
}
function writeConfig(cfg) {
    if (!cfg) return;
    els.cfg.links.value = (cfg.links || []).join('\n');
    els.cfg.instances.value = cfg.instances || 3;
    els.cfg.headless.value = cfg.headless ? 'true' : 'false';
    els.cfg.minDelay.value = cfg.minDelay || 5000;
    els.cfg.maxDelay.value = cfg.maxDelay || 15000;
    els.cfg.viewTime.value = cfg.viewTime || 4000;
    els.cfg.useProxies.value = cfg.useProxies !== false ? 'true' : 'false';
    els.cfg.randomUA.value = cfg.randomizeUA !== false ? 'true' : 'false';
    els.cfg.clearStorage.value = cfg.clearStorage !== false ? 'true' : 'false';
    renderTiers(cfg.tierList || [{ url: '*', weight: 1 }]);
    renderPeaks(cfg.peakHours || [{ start: '09:00', end: '12:00', weight: 1.5 }, { start: '14:00', end: '18:00', weight: 1.2 }, { start: '20:00', end: '23:30', weight: 1.0 }]);
}

// ============ PROXY RENDERER ============
function renderProxies(list) {
    els.proxyStats.textContent = `${(list || []).length} proxies carregados`;
    if (!list || list.length === 0) {
        els.proxyList.innerHTML = '<div class="empty-state">Buscando proxies automaticamente...</div>';
        return;
    }
    els.proxyList.innerHTML = list.map(p => {
        const g = p.geo || {};
        const loc = [g.city, g.region, g.country].filter(Boolean).join(', ');
        const tierColor = p.tier === 1 ? '#22c55e' : p.tier === 2 ? '#f59e0b' : p.tier === 3 ? '#f97316' : '#ef4444';
        return `
        <div class="proxy-chip" style="border-left-color:${tierColor}">
            <div class="proxy-info">
                <span class="proxy-flag">${g.flag || '🌐'}</span>
                <div class="proxy-details">
                    <div class="proxy-addr">${p.protocol}://${p.ip}:${p.port}</div>
                    <div class="proxy-loc">${loc} (${g.countryCode || '??'})</div>
                </div>
            </div>
            <div class="proxy-meta">
                <span class="proxy-ping" style="color:${tierColor}">${p.ping}ms</span>
                <span class="proxy-tier">T${p.tier}</span>
            </div>
        </div>
    `}).join('');
}

// ============ INSTANCE RENDERER ============
function renderInstances(data) {
    const { running, instances, stats } = data || {};
    els.globalStatus.textContent = running ? '● Rodando' : '⏹ Parado';
    els.globalStatus.className = 'status-indicator' + (running ? ' running' : '');
    els.uptime.textContent = (stats && stats.elapsed) ? stats.elapsed : '0h 0m 0s';
    els.statSuccess.textContent = (stats && stats.successCount) || 0;
    els.statFail.textContent = (stats && stats.failCount) || 0;
    els.statRuns.textContent = (stats && stats.totalRuns) || 0;
    els.statRate.textContent = ((stats && stats.successRate) || '0%') + ' taxa';
    els.statInstances.textContent = (instances || []).length;

    if (!instances || instances.length === 0) {
        els.instancesList.innerHTML = '<div class="empty-state">Nenhuma instância rodando.</div>';
        return;
    }
    els.instancesList.innerHTML = instances.map(inst => {
        const phaseText = inst.phase ? `Fase ${inst.phase.current}/${inst.phase.total}` : (inst.status === 'view' ? '👁 View' : '...');
        const pingText = inst.proxyPing ? `${inst.proxyPing}ms` : '';
        const tierText = inst.proxyTier ? `T${inst.proxyTier}` : '';
        return `
        <div class="instance-row">
            <div class="instance-id">#${(inst.id || 0) + 1}</div>
            <div class="instance-info">
                <div class="instance-status ${inst.status || 'idle'}">${(inst.status || 'idle').toUpperCase()}</div>
                <div class="instance-link">${inst.currentLink || 'Aguardando...'}</div>
                <div class="instance-phase">${phaseText}</div>
            </div>
            <div class="instance-meta">
                <div class="instance-proxy">${inst.proxy || 'direto'}</div>
                <div class="instance-ping">${pingText} ${tierText}</div>
                <div class="instance-fp">${inst.fingerprint || ''}</div>
            </div>
        </div>
    `}).join('');
}

function appendLog(entry) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + (entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info');
    div.innerHTML = `<span class="log-time">${entry.time || '--:--:--'}</span><span class="log-inst">${entry.instance || 'MAIN'}</span><span class="log-msg">${entry.message || ''}</span>`;
    els.logsContainer.prepend(div);
    if (els.logsContainer.children.length > 200) els.logsContainer.lastChild.remove();
}

// ============ ACTIONS ============
els.start.addEventListener('click', async () => {
    try {
        const cfg = readConfig();
        if (cfg.links.length === 0) { alert('Adicione pelo menos 1 link!'); return; }
        els.start.disabled = true; els.start.textContent = '⏳ Iniciando...';
        const res = await window.electronAPI.startFarm(cfg);
        els.start.disabled = false; els.start.textContent = '▶ Iniciar Farm';
        if (!res || !res.ok) alert(res.error || 'Erro ao iniciar');
    } catch (e) { console.error(e); alert('Erro: ' + e.message); els.start.disabled = false; els.start.textContent = '▶ Iniciar Farm'; }
});

els.stop.addEventListener('click', async () => {
    try { await window.electronAPI.stopFarm(); } catch (e) { console.error(e); }
});

els.saveCfg.addEventListener('click', async () => {
    try { await window.electronAPI.saveConfig(readConfig()); alert('Config salva!'); }
    catch (e) { alert('Erro ao salvar: ' + e.message); }
});

els.loadCfg.addEventListener('click', async () => {
    try { const cfg = await window.electronAPI.loadConfig(); writeConfig(cfg); }
    catch (e) { alert('Erro ao carregar: ' + e.message); }
});

els.refreshProxies.addEventListener('click', async () => {
    try {
        els.refreshProxies.disabled = true; els.refreshProxies.textContent = '⏳ Testando...';
        const list = await window.electronAPI.refreshProxies();
        renderProxies(list);
    } catch (e) { alert('Erro: ' + e.message); }
    finally { els.refreshProxies.disabled = false; els.refreshProxies.textContent = '🔄 Atualizar & Testar'; }
});

els.clearLogs.addEventListener('click', async () => {
    try { await window.electronAPI.clearLogs(); els.logsContainer.innerHTML = ''; }
    catch (e) { console.error(e); }
});

// ============ IPC ============
window.electronAPI.onConfigLoaded((cfg) => writeConfig(cfg));
window.electronAPI.onStatusUpdate((data) => renderInstances(data));
window.electronAPI.onLog((entry) => appendLog(entry));
window.electronAPI.onProxyUpdated((list) => renderProxies(list));

// ============ INIT ============
(async () => {
    try {
        const cfg = await window.electronAPI.loadConfig();
        writeConfig(cfg);
        const proxies = await window.electronAPI.listProxies();
        renderProxies(proxies);
    } catch (e) { console.error('Init error:', e); }
})();

// Atualiza lista de proxies em tempo real a cada 10s
setInterval(async () => {
    try {
        const proxies = await window.electronAPI.listProxies();
        renderProxies(proxies);
    } catch (e) {}
}, 10000);
