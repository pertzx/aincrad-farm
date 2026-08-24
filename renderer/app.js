// ============ TABS ============
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'analytics') renderAnalytics();
        if (btn.dataset.tab === 'config') renderProfiles();
    });
});

// ============ ELEMENTS ============
const els = {
    start: document.getElementById('btn-start'),
    stop: document.getElementById('btn-stop'),
    refreshProxies: document.getElementById('btn-refresh-proxies'),
    healthCheck: document.getElementById('btn-health-check'),
    clearLogs: document.getElementById('btn-clear-logs'),
    addLink: document.getElementById('btn-add-link'),
    resetPeaks: document.getElementById('btn-reset-peaks'),
    saveProfile: document.getElementById('btn-save-profile'),
    testWebhook: document.getElementById('btn-test-webhook'),
    linksContainer: document.getElementById('links-container'),
    linksTotalPct: document.getElementById('links-total-pct'),
    heatmapContainer: document.getElementById('heatmap-container'),
    statSuccess: document.getElementById('stat-success'),
    statFail: document.getElementById('stat-fail'),
    statEarnings: document.getElementById('stat-earnings'),
    statEarningsSub: document.getElementById('stat-earnings-sub'),
    statInstances: document.getElementById('stat-instances'),
    instancesList: document.getElementById('instances-list'),
    proxyList: document.getElementById('proxy-list'),
    proxyStats: document.getElementById('proxy-stats'),
    logsContainer: document.getElementById('logs-container'),
    globalStatus: document.getElementById('global-status'),
    uptime: document.getElementById('uptime'),
    goalPanel: document.getElementById('goal-panel'),
    goalText: document.getElementById('goal-text'),
    goalBarFill: document.getElementById('goal-bar-fill'),
    goalSub: document.getElementById('goal-sub'),
    goalMiniFill: document.getElementById('goal-mini-fill'),
    goalMiniText: document.getElementById('goal-mini-text'),
    earnToday: document.getElementById('earn-today'),
    earnMonth: document.getElementById('earn-month'),
    earnYear: document.getElementById('earn-year'),
    linkStatsContainer: document.getElementById('link-stats-container'),
    timelineContainer: document.getElementById('timeline-container'),
    blacklistStatus: document.getElementById('blacklist-status'),
    profilesList: document.getElementById('profiles-list'),
    cfg: {
        instances: document.getElementById('cfg-instances'),
        headless: document.getElementById('cfg-headless'),
        minDelay: document.getElementById('cfg-min-delay'),
        maxDelay: document.getElementById('cfg-max-delay'),
        viewTime: document.getElementById('cfg-view-time'),
        useProxies: document.getElementById('cfg-use-proxies'),
        randomUA: document.getElementById('cfg-random-ua'),
        clearStorage: document.getElementById('cfg-clear-storage'),
        stealth: document.getElementById('cfg-stealth'),
        earnings: document.getElementById('cfg-earnings'),
        goalEnabled: document.getElementById('cfg-goal-enabled'),
        goalAmount: document.getElementById('cfg-goal-amount'),
        blacklistEnabled: document.getElementById('cfg-blacklist-enabled'),
        blacklistMax: document.getElementById('cfg-blacklist-max'),
        blacklistCooldown: document.getElementById('cfg-blacklist-cooldown'),
        cooldownEnabled: document.getElementById('cfg-cooldown-enabled'),
        cooldownMin: document.getElementById('cfg-cooldown-min'),
        webhookEnabled: document.getElementById('cfg-webhook-enabled'),
        webhookType: document.getElementById('cfg-webhook-type'),
        webhookUrl: document.getElementById('cfg-webhook-url'),
        webhookToken: document.getElementById('cfg-webhook-token'),
        webhookChat: document.getElementById('cfg-webhook-chat'),
        profileName: document.getElementById('cfg-profile-name'),
        profileSelect: document.getElementById('cfg-profile-select'),
    }
};

// ============ STATE ============
let linksData = [];
let heatmapData = Array(24).fill(0);
let analyticsData = null;
let autoSaveTimer = null;
let isRunning = false;

const DEFAULT_PEAKS = [5, 3, 2, 2, 3, 5, 10, 25, 55, 80, 90, 85, 75, 70, 75, 80, 85, 90, 95, 100, 85, 60, 30, 15];

// ============ LINKS ============
function renderLinks() {
    els.linksContainer.innerHTML = '';
    const totalWeight = linksData.reduce((s, l) => s + (l.weight || 1), 0);
    
    linksData.forEach((link, idx) => {
        const pct = totalWeight > 0 ? ((link.weight / totalWeight) * 100).toFixed(1) : 0;
        const row = document.createElement('div');
        row.className = 'link-row';
        row.innerHTML = `
            <div class="link-row-top">
                <input type="text" class="link-url" placeholder="https://..." value="${link.url || ''}">
                <button class="btn-icon" data-idx="${idx}" title="Remover">🗑</button>
            </div>
            <div class="link-row-bottom">
                <input type="range" class="link-weight" min="1" max="100" value="${link.weight || 1}">
                <div class="link-pct-box">
                    <span class="link-pct">${pct}%</span>
                    <span class="link-weight-label">peso ${link.weight || 1}</span>
                </div>
            </div>
        `;
        
        const urlInput = row.querySelector('.link-url');
        const weightInput = row.querySelector('.link-weight');
        const removeBtn = row.querySelector('.btn-icon');
        
        urlInput.addEventListener('change', () => {
            linksData[idx].url = urlInput.value.trim();
            autoSave();
        });
        
        weightInput.addEventListener('input', (e) => {
            linksData[idx].weight = parseInt(e.target.value) || 1;
            renderLinks();
            autoSave();
        });
        
        removeBtn.addEventListener('click', () => {
            linksData.splice(idx, 1);
            renderLinks();
            autoSave();
        });
        
        els.linksContainer.appendChild(row);
    });
    
    els.linksTotalPct.textContent = `Total: ${linksData.length} link(s)`;
}

els.addLink.addEventListener('click', () => {
    linksData.push({ url: '', weight: 10 });
    renderLinks();
    autoSave();
});

// ============ HEATMAP ============
function renderHeatmap() {
    els.heatmapContainer.innerHTML = '';
    const max = Math.max(...heatmapData, 1);
    
    heatmapData.forEach((val, i) => {
        const bar = document.createElement('div');
        bar.className = 'heatmap-bar';
        const pct = (val / max) * 100;
        const intensity = val / 100;
        const r = Math.round(220 * intensity + 20 * (1 - intensity));
        const g = Math.round(38 * intensity + 20 * (1 - intensity));
        const b = Math.round(38 * intensity + 30 * (1 - intensity));
        bar.style.height = `${Math.max(pct, 3)}%`;
        bar.style.background = `rgb(${r},${g},${b})`;
        bar.title = `${String(i).padStart(2,'0')}:00 — ${Math.round(val)}%`;
        
        let dragging = false;
        
        bar.addEventListener('mousedown', (e) => {
            dragging = true;
            e.preventDefault();
            updateBarFromMouse(e, bar, i);
        });
        
        bar.addEventListener('mouseenter', (e) => {
            if (e.buttons === 1) updateBarFromMouse(e, bar, i);
        });
        
        document.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; autoSave(); }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (dragging) updateBarFromMouse(e, bar, i);
        });
        
        els.heatmapContainer.appendChild(bar);
    });
}

function updateBarFromMouse(e, bar, idx) {
    const rect = els.heatmapContainer.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const newVal = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    heatmapData[idx] = Math.round(newVal);
    renderHeatmap();
}

els.resetPeaks.addEventListener('click', () => {
    heatmapData = [...DEFAULT_PEAKS];
    renderHeatmap();
    autoSave();
});

// ============ CONFIG READ/WRITE ============
function readConfig() {
    return {
        links: linksData.filter(l => l.url.trim()),
        instances: parseInt(els.cfg.instances.value, 10) || 1,
        headless: els.cfg.headless.value === 'true',
        minDelay: parseInt(els.cfg.minDelay.value, 10) || 5000,
        maxDelay: parseInt(els.cfg.maxDelay.value, 10) || 15000,
        viewTime: parseInt(els.cfg.viewTime.value, 10) || 4000,
        useProxies: els.cfg.useProxies.value === 'true',
        randomizeUA: els.cfg.randomUA.value === 'true',
        clearStorage: els.cfg.clearStorage.value === 'true',
        stealthMode: els.cfg.stealth.value === 'true',
        peakHours: heatmapData,
        earningsPerBypass: parseFloat(els.cfg.earnings.value) || 0.05,
        dailyGoal: {
            enabled: els.cfg.goalEnabled.value === 'true',
            amount: parseFloat(els.cfg.goalAmount.value) || 50,
            currency: 'BRL'
        },
        blacklist: {
            enabled: els.cfg.blacklistEnabled.value === 'true',
            maxFails: parseInt(els.cfg.blacklistMax.value, 10) || 5,
            cooldownMinutes: parseInt(els.cfg.blacklistCooldown.value, 10) || 30
        },
        linkCooldown: {
            enabled: els.cfg.cooldownEnabled.value === 'true',
            minutes: parseInt(els.cfg.cooldownMin.value, 10) || 10
        },
        webhook: {
            enabled: els.cfg.webhookEnabled.value === 'true',
            type: els.cfg.webhookType.value,
            url: els.cfg.webhookUrl.value.trim(),
            botToken: els.cfg.webhookToken.value.trim(),
            chatId: els.cfg.webhookChat.value.trim()
        }
    };
}

function writeConfig(cfg) {
    if (!cfg) return;
    
    linksData = (cfg.links || []).map(l => typeof l === 'string' ? { url: l, weight: 10 } : { ...l });
    if (linksData.length === 0) linksData = [{ url: '', weight: 10 }];
    renderLinks();
    
    heatmapData = (cfg.peakHours || DEFAULT_PEAKS).slice(0, 24);
    if (heatmapData.length < 24) {
        while (heatmapData.length < 24) heatmapData.push(5);
    }
    renderHeatmap();
    
    // Gerais
    els.cfg.instances.value = cfg.instances || 3;
    els.cfg.headless.value = cfg.headless ? 'true' : 'false';
    els.cfg.minDelay.value = cfg.minDelay || 5000;
    els.cfg.maxDelay.value = cfg.maxDelay || 15000;
    els.cfg.viewTime.value = cfg.viewTime || 4000;
    els.cfg.useProxies.value = cfg.useProxies !== false ? 'true' : 'false';
    els.cfg.randomUA.value = cfg.randomizeUA !== false ? 'true' : 'false';
    els.cfg.clearStorage.value = cfg.clearStorage !== false ? 'true' : 'false';
    els.cfg.stealth.value = cfg.stealthMode ? 'true' : 'false';
    els.cfg.earnings.value = cfg.earningsPerBypass || 0.05;
    
    const goal = cfg.dailyGoal || { enabled: false, amount: 50 };
    els.cfg.goalEnabled.value = goal.enabled ? 'true' : 'false';
    els.cfg.goalAmount.value = goal.amount || 50;
    
    // Blacklist
    const bl = cfg.blacklist || { enabled: true, maxFails: 5, cooldownMinutes: 30 };
    els.cfg.blacklistEnabled.value = bl.enabled ? 'true' : 'false';
    els.cfg.blacklistMax.value = bl.maxFails || 5;
    els.cfg.blacklistCooldown.value = bl.cooldownMinutes || 30;
    
    // Cooldown
    const cd = cfg.linkCooldown || { enabled: true, minutes: 10 };
    els.cfg.cooldownEnabled.value = cd.enabled ? 'true' : 'false';
    els.cfg.cooldownMin.value = cd.minutes || 10;
    
    // Webhook
    const wh = cfg.webhook || { enabled: false, type: 'discord', url: '', botToken: '', chatId: '' };
    els.cfg.webhookEnabled.value = wh.enabled ? 'true' : 'false';
    els.cfg.webhookType.value = wh.type || 'discord';
    els.cfg.webhookUrl.value = wh.url || '';
    els.cfg.webhookToken.value = wh.botToken || '';
    els.cfg.webhookChat.value = wh.chatId || '';
    updateWebhookUI();
    
    updateGoalUI();
    updateEarningsUI();
    updateBlacklistUI(cfg);
}

// ============ AUTO-SAVE ============
function autoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
        try {
            const cfg = readConfig();
            await window.electronAPI.saveConfig(cfg);
        } catch (e) { console.error('Auto-save error:', e); }
    }, 500);
}

Object.values(els.cfg).forEach(el => {
    if (!el) return;
    el.addEventListener('change', autoSave);
    el.addEventListener('input', autoSave);
});

// ============ WEBHOOK UI ============
function updateWebhookUI() {
    const type = els.cfg.webhookType.value;
    document.getElementById('webhook-discord-group').style.display = type === 'discord' ? 'block' : 'none';
    document.getElementById('webhook-telegram-group').style.display = type === 'telegram' ? 'block' : 'none';
}
els.cfg.webhookType.addEventListener('change', () => { updateWebhookUI(); autoSave(); });

els.testWebhook.addEventListener('click', async () => {
    try {
        els.testWebhook.textContent = '⏳ Enviando...';
        const cfg = readConfig().webhook;
        const res = await window.electronAPI.testWebhook(cfg);
        els.testWebhook.textContent = res.ok ? '✅ Enviado!' : '❌ Falhou';
        setTimeout(() => els.testWebhook.textContent = '🧪 Testar Webhook', 3000);
    } catch (e) {
        els.testWebhook.textContent = '❌ Erro';
        setTimeout(() => els.testWebhook.textContent = '🧪 Testar Webhook', 3000);
    }
});

// ============ PROFILES ============
async function renderProfiles() {
    try {
        const profiles = await window.electronAPI.listProfiles();
        const list = els.profilesList;
        list.innerHTML = '';
        
        const select = els.cfg.profileSelect;
        select.innerHTML = '<option value="">-- Selecione --</option>';
        
        Object.entries(profiles).forEach(([name, data]) => {
            select.innerHTML += `<option value="${name}">${name}</option>`;
            
            const item = document.createElement('div');
            item.className = 'profile-item';
            const date = data.savedAt ? new Date(data.savedAt).toLocaleDateString('pt-BR') : '?';
            item.innerHTML = `
                <div class="profile-info">
                    <div class="profile-name">${name}</div>
                    <div class="profile-meta">${(data.links || []).length} links · ${date}</div>
                </div>
                <div class="profile-actions">
                    <button class="btn-icon" data-name="${name}" data-action="load">📂</button>
                    <button class="btn-icon" data-name="${name}" data-action="delete" style="color:#ef4444">🗑</button>
                </div>
            `;
            list.appendChild(item);
        });
        
        list.querySelectorAll('.btn-icon').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.dataset.name;
                if (btn.dataset.action === 'load') {
                    const profile = await window.electronAPI.loadProfile(name);
                    if (profile) {
                        writeConfig(profile);
                        await window.electronAPI.saveConfig(readConfig());
                        alert(`Perfil "${name}" carregado!`);
                    }
                } else if (btn.dataset.action === 'delete') {
                    if (confirm(`Deletar perfil "${name}"?`)) {
                        await window.electronAPI.deleteProfile(name);
                        renderProfiles();
                    }
                }
            });
        });
    } catch (e) { console.error('Profiles error:', e); }
}

els.saveProfile.addEventListener('click', async () => {
    const name = els.cfg.profileName.value.trim();
    if (!name) { alert('Digite um nome para o perfil!'); return; }
    try {
        await window.electronAPI.saveProfile(name, readConfig());
        els.cfg.profileName.value = '';
        renderProfiles();
        alert(`Perfil "${name}" salvo!`);
    } catch (e) { alert('Erro: ' + e.message); }
});

els.cfg.profileSelect.addEventListener('change', async () => {
    const name = els.cfg.profileSelect.value;
    if (!name) return;
    const profile = await window.electronAPI.loadProfile(name);
    if (profile) {
        writeConfig(profile);
        await window.electronAPI.saveConfig(readConfig());
        alert(`Perfil "${name}" carregado!`);
    }
});

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
        const statusDot = p.alive !== false ? '●' : '○';
        const statusColor = p.alive !== false ? '#22c55e' : '#ef4444';
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
                <span style="color:${statusColor};font-size:11px">${statusDot} ${p.alive !== false ? 'ONLINE' : 'OFFLINE'}</span>
                <span class="proxy-ping" style="color:${tierColor}">${p.ping}ms</span>
                <span class="proxy-tier">T${p.tier}</span>
            </div>
            <button class="btn-trace" data-proxy='${JSON.stringify(p).replace(/'/g, "&#39;")}'>🔍 Rastrear</button>
        </div>
    `}).join('');
    
    document.querySelectorAll('.btn-trace').forEach(btn => {
        btn.addEventListener('click', async () => {
            const proxy = JSON.parse(btn.dataset.proxy);
            try {
                btn.textContent = '⏳';
                await window.electronAPI.testProxyTrace(proxy);
                btn.textContent = '🔍 Rastrear';
            } catch (e) {
                btn.textContent = '❌';
                setTimeout(() => btn.textContent = '🔍 Rastrear', 2000);
            }
        });
    });
}

els.healthCheck.addEventListener('click', async () => {
    try {
        els.healthCheck.disabled = true;
        els.healthCheck.textContent = '⏳ Verificando...';
        await window.electronAPI.healthCheckProxies();
        const list = await window.electronAPI.listProxies();
        renderProxies(list);
        els.healthCheck.textContent = '❤️ Health Check';
        els.healthCheck.disabled = false;
    } catch (e) {
        els.healthCheck.textContent = '❤️ Health Check';
        els.healthCheck.disabled = false;
    }
});

// ============ INSTANCE RENDERER ============
function renderInstances(data) {
    const { running, instances, stats } = data || {};
    isRunning = running;
    els.globalStatus.textContent = running ? '● Rodando' : '⏹ Parado';
    els.globalStatus.className = 'status-indicator' + (running ? ' running' : '');
    els.uptime.textContent = (stats && stats.elapsed) ? stats.elapsed : '0h 0m 0s';
    els.statSuccess.textContent = (stats && stats.successCount) || 0;
    els.statFail.textContent = (stats && stats.failCount) || 0;
    els.statInstances.textContent = (instances || []).length;

    updateEarningsUI();
    updateGoalUI();

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

// ============ ANALYTICS ============
function updateEarningsUI() {
    const perBypass = parseFloat(els.cfg.earnings.value) || 0.05;
    const success = parseInt(els.statSuccess.textContent) || 0;
    const today = success * perBypass;
    const month = today * 30;
    const year = today * 365;
    
    els.statEarnings.textContent = `R$ ${today.toFixed(2).replace('.', ',')}`;
    els.statEarningsSub.textContent = `R$ ${perBypass.toFixed(3).replace('.', ',')} / bypass`;
    els.earnToday.textContent = `R$ ${today.toFixed(2).replace('.', ',')}`;
    els.earnMonth.textContent = `R$ ${month.toFixed(2).replace('.', ',')}`;
    els.earnYear.textContent = `R$ ${year.toFixed(2).replace('.', ',')}`;
}

function updateGoalUI() {
    const goalEnabled = els.cfg.goalEnabled.value === 'true';
    const goalAmount = parseFloat(els.cfg.goalAmount.value) || 50;
    const perBypass = parseFloat(els.cfg.earnings.value) || 0.05;
    const success = parseInt(els.statSuccess.textContent) || 0;
    const earned = success * perBypass;
    const pct = goalAmount > 0 ? Math.min(100, (earned / goalAmount) * 100) : 0;
    
    if (goalEnabled) {
        els.goalPanel.style.display = 'block';
        els.goalText.textContent = `R$ ${earned.toFixed(2).replace('.', ',')} / R$ ${goalAmount.toFixed(2).replace('.', ',')}`;
        els.goalBarFill.style.width = `${pct}%`;
        els.goalBarFill.style.background = pct >= 100 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#dc2626';
        const remaining = Math.max(0, goalAmount - earned);
        const needed = remaining > 0 ? Math.ceil(remaining / perBypass) : 0;
        els.goalSub.textContent = pct >= 100 ? '🎉 Meta batida! Farm será pausado.' : `Faltam R$ ${remaining.toFixed(2).replace('.', ',')} — ~${needed} bypasses`;
        
        els.goalMiniFill.style.width = `${pct}%`;
        els.goalMiniFill.style.background = pct >= 100 ? '#22c55e' : '#dc2626';
        els.goalMiniText.textContent = `R$ ${earned.toFixed(2).replace('.', ',')} / R$ ${goalAmount.toFixed(2).replace('.', ',')}`;
    } else {
        els.goalPanel.style.display = 'none';
        els.goalMiniFill.style.width = '0%';
        els.goalMiniText.textContent = 'Meta desativada';
    }
}

function updateBlacklistUI(cfg) {
    const paused = cfg.pausedLinks || {};
    const entries = Object.entries(paused);
    if (entries.length === 0) {
        els.blacklistStatus.textContent = 'Nenhum link na blacklist.';
        els.blacklistStatus.className = 'tip-box';
    } else {
        const now = Date.now();
        const blCfg = cfg.blacklist || { cooldownMinutes: 30 };
        const active = entries.filter(([,v]) => now < v.pausedAt + (blCfg.cooldownMinutes * 60 * 1000));
        if (active.length === 0) {
            els.blacklistStatus.textContent = 'Nenhum link na blacklist.';
            els.blacklistStatus.className = 'tip-box';
        } else {
            els.blacklistStatus.innerHTML = active.map(([url, v]) => {
                const remaining = Math.ceil((v.pausedAt + blCfg.cooldownMinutes * 60 * 1000 - now) / 60000);
                return `<div>⛔ ${url} — ${remaining}min restantes</div>`;
            }).join('');
            els.blacklistStatus.className = 'tip-box warning';
        }
    }
}

async function renderAnalytics() {
    try {
        const data = await window.electronAPI.getAnalytics();
        analyticsData = data;
        
        const stats = data.linkStats || {};
        const links = Object.entries(stats);
        if (links.length === 0) {
            els.linkStatsContainer.innerHTML = '<div class="empty-state">Nenhum dado ainda. Inicie o farm para coletar estatísticas.</div>';
        } else {
            const totalSuccess = links.reduce((s, [,v]) => s + (v.success || 0), 0);
            els.linkStatsContainer.innerHTML = links.map(([url, stat]) => {
                const s = stat.success || 0;
                const f = stat.fail || 0;
                const total = s + f;
                const rate = total > 0 ? ((s / total) * 100).toFixed(1) : 0;
                const pct = totalSuccess > 0 ? ((s / totalSuccess) * 100).toFixed(1) : 0;
                return `
                <div class="link-stat-row">
                    <div class="link-stat-info">
                        <div class="link-stat-url">${url}</div>
                        <div class="link-stat-detail">${s} sucessos · ${f} falhas · ${rate}% taxa</div>
                    </div>
                    <div class="link-stat-bar-wrap">
                        <div class="link-stat-bar" style="width:${pct}%"></div>
                    </div>
                    <div class="link-stat-pct">${pct}%</div>
                </div>`;
            }).join('');
        }
        
        const daily = data.dailyStats || {};
        const days = Object.entries(daily).sort().slice(-7);
        if (days.length === 0) {
            els.timelineContainer.innerHTML = '<div class="empty-state">Nenhum dado histórico.</div>';
        } else {
            const maxVal = Math.max(...days.map(([,v]) => (v.success || 0) + (v.fail || 0)), 1);
            els.timelineContainer.innerHTML = `
            <div class="timeline-chart">
                ${days.map(([date, v]) => {
                    const total = (v.success || 0) + (v.fail || 0);
                    const h = (total / maxVal) * 100;
                    const sPct = total > 0 ? ((v.success || 0) / total) * 100 : 0;
                    return `
                    <div class="timeline-col">
                        <div class="timeline-bar" style="height:${h}%">
                            <div class="timeline-bar-success" style="height:${sPct}%"></div>
                        </div>
                        <div class="timeline-label">${date.slice(5)}</div>
                    </div>`;
                }).join('')}
            </div>`;
        }
    } catch (e) { console.error('Analytics error:', e); }
}

// ============ ACTIONS ============
els.start.addEventListener('click', async () => {
    try {
        const cfg = readConfig();
        if (cfg.links.length === 0) { alert('Adicione pelo menos 1 link!'); return; }
        
        const goal = cfg.dailyGoal || {};
        if (goal.enabled) {
            const data = await window.electronAPI.getAnalytics();
            const today = new Date().toISOString().split('T')[0];
            const todaySuccess = (data.dailyStats && data.dailyStats[today] && data.dailyStats[today].success) || 0;
            const earned = todaySuccess * (cfg.earningsPerBypass || 0.05);
            if (earned >= goal.amount) {
                alert('🎉 Meta diária já foi batida!');
                return;
            }
        }
        
        els.start.disabled = true; els.start.textContent = '⏳ Iniciando...';
        const res = await window.electronAPI.startFarm(cfg);
        els.start.disabled = false; els.start.textContent = '▶ Iniciar Farm';
        if (!res || !res.ok) alert(res.error || 'Erro ao iniciar');
    } catch (e) { console.error(e); alert('Erro: ' + e.message); els.start.disabled = false; els.start.textContent = '▶ Iniciar Farm'; }
});

els.stop.addEventListener('click', async () => {
    try { await window.electronAPI.stopFarm(); } catch (e) { console.error(e); }
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
        await renderAnalytics();
        await renderProfiles();
    } catch (e) { console.error('Init error:', e); }
})();

setInterval(async () => {
    try { const proxies = await window.electronAPI.listProxies(); renderProxies(proxies); }
    catch (e) {}
}, 10000);

setInterval(() => { if (isRunning) renderAnalytics(); }, 30000);

els.cfg.earnings.addEventListener('input', () => { updateEarningsUI(); updateGoalUI(); autoSave(); });
els.cfg.goalEnabled.addEventListener('change', () => { updateGoalUI(); autoSave(); });
els.cfg.goalAmount.addEventListener('input', () => { updateGoalUI(); autoSave(); });