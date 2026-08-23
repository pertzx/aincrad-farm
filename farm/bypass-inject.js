(function () {
    "use strict";

	const originalOpen = window.open;

window.open = function (...args) {
    console.log("window.open chamado:", args);
    console.trace();

    // bloqueia
    return null;
};

    const ACCESS_KEY = "RORAX";
    const LOGO_URL = "https://raw.githubusercontent.com/robinhossainraaj/rorax-iptv-database/refs/heads/main/logo.png";
    const TELEGRAM_URL = "https://t.me/rorax_x";
    const OVERLAY_ID = "aincrad-bypass-overlay";
    const STYLE_ID = "aincrad-bypass-style";
    const STATE_KEY = "aincrad_bypass_state_v6";
    const HOST = location.hostname.toLowerCase();

    const SUPPORTED_ROOTS = [
        "alpharede.com","rodaemotor.com","guis2.com",
        "horoscopeonday.com","forumdinheiro.com",
        "milbviral.com","tarviral.com","aincradmods.com"
    ];

    function isSupportedHost(host) {
        return SUPPORTED_ROOTS.some(function (root) {
            return host === root || host.endsWith("." + root);
        });
    }

    if (!isSupportedHost(HOST)) return;
    if (window !== window.top) return;
    if (window.__AINCRAD_BYPASS_V6__) return;
    window.__AINCRAD_BYPASS_V6__ = true;

    // Storage sem GM_*
    function getState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function setState(update) {
        try {
            const old = getState();
            localStorage.setItem(STATE_KEY, JSON.stringify({ ...old, ...update, updatedAt: Date.now() }));
        } catch (e) {}
    }
    function clearState() {
        try { localStorage.removeItem(STATE_KEY); } catch (e) {}
    }

    let overlay = null, observer = null, watchdog = null, rebuilding = false;
    let manuallyClosed = false, bypassRunning = false, startedThisPage = false, finalUrl = null;
    let logoImage = null, logoContainer = null, input = null, unlockButton = null, errorElement = null;
    let eyeButton = null, circleSection = null, progressArc = null, numberElement = null;
    let secondsLabel = null, stageText = null, statusElement = null, inputLabel = null;
    let inputWrapper = null, closeButton = null;

    const STYLE_TEXT = `
        @keyframes aincradSlide { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0);} }
        @keyframes aincradPulseSmall { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,.25);} 50% { box-shadow:0 0 0 5px rgba(220,38,38,0);} }
        #aincrad-bypass-overlay { position:fixed !important; right:18px !important; bottom:18px !important; top:auto !important; left:auto !important;
            width:auto !important; height:auto !important; z-index:2147483647 !important; display:flex !important;
            background:transparent !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
            pointer-events:none !important; visibility:visible !important; opacity:1 !important;
            font-family:'Rajdhani',Arial,sans-serif !important; isolation:isolate !important; }
        #aincrad-bypass-box { position:relative !important; width:245px !important; box-sizing:border-box !important; padding:12px !important;
            border:1px solid rgba(255,255,255,.08) !important; border-radius:14px !important;
            background:rgba(12,12,20,.94) !important; box-shadow:0 10px 30px rgba(0,0,0,.35) !important;
            backdrop-filter:blur(12px) !important; -webkit-backdrop-filter:blur(12px) !important;
            z-index:2147483647 !important; pointer-events:auto !important; visibility:visible !important; opacity:1 !important;
            animation:aincradSlide .2s ease; }
        #aincrad-scan-line { display:none !important; }
        #aincrad-logo-wrap { display:flex !important; align-items:center !important; flex-direction:row !important; gap:9px !important; margin:0 !important; padding:0 !important; }
        #aincrad-logo { width:34px !important; height:34px !important; flex:0 0 34px !important; border-radius:9px !important;
            overflow:hidden !important; border:1px solid rgba(220,38,38,.22) !important; margin:0 !important;
            animation:aincradPulseSmall 2.5s infinite !important; }
        #aincrad-logo img { width:100% !important; height:100% !important; object-fit:cover !important; display:block !important; }
        #aincrad-title { color:#fff !important; font-size:13px !important; font-weight:700 !important; line-height:1.1 !important; text-align:left !important; }
        #aincrad-subtitle { margin-top:2px !important; color:rgba(220,38,38,.65) !important; font-size:8px !important; letter-spacing:2px !important; text-align:left !important; }
        #aincrad-divider { height:1px !important; margin:10px 0 !important; background:rgba(255,255,255,.06) !important; }
        #aincrad-close { position:absolute !important; top:6px !important; right:7px !important; width:20px !important; height:20px !important;
            padding:0 !important; border:none !important; background:transparent !important; color:rgba(255,255,255,.25) !important;
            font-size:13px !important; line-height:20px !important; cursor:pointer !important; z-index:20 !important; }
        #aincrad-close:hover { color:rgba(255,255,255,.75) !important; }
        #aincrad-circle-section { display:none; width:100%; padding:0; flex-direction:column; align-items:center; }
        #aincrad-svg-wrapper { display:none !important; }
        #aincrad-stage-text { margin:0 !important; color:#fff !important; font-size:12px !important; font-weight:700 !important;
            letter-spacing:1px !important; text-transform:none !important; text-align:left !important; }
        #aincrad-status { min-height:auto !important; margin-top:4px !important; color:rgba(255,255,255,.4) !important;
            font-size:10px !important; text-align:left !important; }
        #aincrad-big-number,#aincrad-seconds-label { display:none !important; }
        #aincrad-stage-progress { display:block !important; width:100% !important; height:4px !important;
            margin-top:8px !important; border-radius:999px !important; background:rgba(255,255,255,.06) !important; overflow:hidden !important; }
        #aincrad-stage-progress-bar { width:0%; height:100%; border-radius:inherit; background:#dc2626;
            transition:width .25s ease,background .25s ease; }
        #aincrad-input-label { display:none !important; }
        #aincrad-input-wrapper { display:none !important; }
        #aincrad-error { min-height:auto !important; margin:5px 0 !important; color:#ef4444 !important;
            font-size:10px !important; text-align:center !important; }
        #aincrad-unlock-button { display:block; width:100% !important; padding:9px 12px !important; border:none !important;
            border-radius:8px !important; background:#dc2626 !important; color:#fff !important; font-size:11px !important;
            font-weight:700 !important; letter-spacing:1px !important; text-transform:uppercase !important; cursor:pointer !important;
            transition:opacity .15s,transform .15s !important; }
        #aincrad-unlock-button:hover { opacity:.9 !important; }
        #aincrad-unlock-button:active { transform:scale(.98) !important; }
        #aincrad-telegram { display:none !important; }
        @media (max-width:600px) { #aincrad-bypass-overlay { right:10px !important; bottom:10px !important; }
            #aincrad-bypass-box { width:220px !important; } }
    `;

    function ensureStyle() {
        const existing = document.getElementById(STYLE_ID);
        if (existing) return;
        const element = document.createElement("style");
        element.id = STYLE_ID;
        element.textContent = STYLE_TEXT;
        (document.head || document.documentElement).appendChild(element);
    }

    function createOverlay() {
        const element = document.createElement("div");
        element.id = OVERLAY_ID;
        element.innerHTML = `
            <div id="aincrad-bypass-box">
                <div id="aincrad-scan-line"></div>
                <button id="aincrad-close" type="button" aria-label="Fechar">✕</button>
                <div id="aincrad-logo-wrap">
                    <div id="aincrad-logo"><img src="${LOGO_URL}" id="aincrad-logo-image" alt=""></div>
                    <div><div id="aincrad-title">Aincrad Bypass</div><div id="aincrad-subtitle">RORAX Edition</div></div>
                </div>
                <div id="aincrad-divider"></div>
                <div id="aincrad-circle-section">
                    <div id="aincrad-svg-wrapper">
                        <svg width="120" height="120" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="5"/>
                            <circle id="aincrad-progress-arc" cx="60" cy="60" r="52" fill="none" stroke="#dc2626" stroke-width="5"
                                stroke-dasharray="327" stroke-dashoffset="327" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                        </svg>
                        <div id="aincrad-circle-number"><span id="aincrad-big-number">0</span><span id="aincrad-seconds-label">STAGE</span></div>
                    </div>
                    <div id="aincrad-stage-text">Pronto para iniciar</div>
                    <div id="aincrad-status">Clique para continuar</div>
                    <div id="aincrad-stage-progress"><div id="aincrad-stage-progress-bar"></div></div>
                </div>
                <label id="aincrad-input-label">Access Key</label>
                <div id="aincrad-input-wrapper">
                    <input id="aincrad-input" type="password" placeholder="Enter key to unlock">
                    <button id="aincrad-eye" type="button">👁</button>
                </div>
                <div id="aincrad-error"></div>
                <button id="aincrad-unlock-button" type="button">Iniciar Bypass</button>
                <a id="aincrad-telegram" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">t.me/rorax_x</a>
            </div>`;
        return element;
    }

    function cacheElements() {
        if (!overlay) return;
        logoImage = overlay.querySelector("#aincrad-logo-image");
        logoContainer = overlay.querySelector("#aincrad-logo");
        input = overlay.querySelector("#aincrad-input");
        unlockButton = overlay.querySelector("#aincrad-unlock-button");
        errorElement = overlay.querySelector("#aincrad-error");
        eyeButton = overlay.querySelector("#aincrad-eye");
        circleSection = overlay.querySelector("#aincrad-circle-section");
        progressArc = overlay.querySelector("#aincrad-progress-arc");
        numberElement = overlay.querySelector("#aincrad-big-number");
        secondsLabel = overlay.querySelector("#aincrad-seconds-label");
        stageText = overlay.querySelector("#aincrad-stage-text");
        statusElement = overlay.querySelector("#aincrad-status");
        inputLabel = overlay.querySelector("#aincrad-input-label");
        inputWrapper = overlay.querySelector("#aincrad-input-wrapper");
        closeButton = overlay.querySelector("#aincrad-close");
    }

    function ensureProgressBar() {
        if (!overlay) return;
        let progress = overlay.querySelector("#aincrad-stage-progress");
        if (progress) return;
        const status = overlay.querySelector("#aincrad-status");
        if (!status) return;
        progress = document.createElement("div");
        progress.id = "aincrad-stage-progress";
        progress.innerHTML = `<div id="aincrad-stage-progress-bar"></div>`;
        status.after(progress);
    }

    function protectOverlay() {
        if (!overlay) return;
        overlay.style.setProperty("position","fixed","important");
        overlay.style.setProperty("right","18px","important");
        overlay.style.setProperty("bottom","18px","important");
        overlay.style.setProperty("top","auto","important");
        overlay.style.setProperty("left","auto","important");
        overlay.style.setProperty("width","auto","important");
        overlay.style.setProperty("height","auto","important");
        overlay.style.setProperty("background","transparent","important");
        overlay.style.setProperty("backdrop-filter","none","important");
        overlay.style.setProperty("-webkit-backdrop-filter","none","important");
        overlay.style.setProperty("pointer-events","none","important");
        overlay.style.setProperty("z-index","2147483647","important");
        const box = overlay.querySelector("#aincrad-bypass-box");
        if (box) {
            box.style.setProperty("pointer-events","auto","important");
            box.style.setProperty("z-index","2147483647","important");
        }
    }

    function showIdleUI() {
        bypassRunning = false;
        if (circleSection) circleSection.style.display = "none";
        if (unlockButton) { unlockButton.style.display = "block"; unlockButton.textContent = "Iniciar Bypass"; }
        if (stageText) stageText.textContent = "Pronto para iniciar";
        if (statusElement) statusElement.textContent = "Clique para continuar";
        if (errorElement) errorElement.textContent = "";
        if (closeButton) closeButton.style.display = "block";
        const progressBar = overlay?.querySelector("#aincrad-stage-progress-bar");
        if (progressBar) { progressBar.style.width = "0%"; progressBar.style.background = "#dc2626"; }
    }

    function showBypassUI() {
        ensureProgressBar();
        if (circleSection) circleSection.style.display = "flex";
        if (unlockButton) unlockButton.style.display = "none";
        if (inputWrapper) inputWrapper.style.display = "none";
        if (inputLabel) inputLabel.style.display = "none";
        if (errorElement) errorElement.style.display = "none";
        if (closeButton) closeButton.style.display = "block";
    }

    function renderStage(current, total, status) {
        showBypassUI();
        if (stageText) stageText.textContent = "Fase " + current + " / " + total;
        if (statusElement) statusElement.textContent = status || "Processando...";
        const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
        const progressBar = overlay?.querySelector("#aincrad-stage-progress-bar");
        if (progressBar) {
            progressBar.style.width = percentage + "%";
            progressBar.style.background = current >= total ? "#22c55e" : "#dc2626";
        }
        // Notifica Electron do progresso
        if (window.__AINCRAD_NOTIFY_PHASE__) {
            window.__AINCRAD_NOTIFY_PHASE__(current, total);
        }
    }

    function restoreState() {
        const state = getState();
        if (state.dismissed || state.completed || !state.active) { showIdleUI(); return; }
        if (state.currentStage != null && state.totalStages != null) {
            showBypassUI();
            renderStage(Number(state.currentStage), Number(state.totalStages), state.status || "Processando...");
            return;
        }
        showBypassUI();
        if (stageText) stageText.textContent = "Conectando...";
        if (statusElement) statusElement.textContent = state.status || "Obtendo sessão...";
    }

    function attachEvents() {
        if (!overlay) return;
        if (logoImage) {
            logoImage.onerror = function () {
                if (logoContainer) {
                    logoContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a0a0a;font-size:24px;">⚔️</div>`;
                }
            };
        }
        if (closeButton) {
            closeButton.onclick = function (event) {
                event.preventDefault(); event.stopPropagation();
                manuallyClosed = true; bypassRunning = false;
                setState({ active:false, running:false, dismissed:true, completed:false, currentStage:null, totalStages:null, status:"" });
                if (overlay) overlay.remove();
                console.log("[AINCRAD] UI fechada.");
            };
        }
        if (eyeButton) {
            eyeButton.onclick = function () {
                if (!input) return;
                input.type = input.type === "password" ? "text" : "password";
                eyeButton.textContent = input.type === "password" ? "👁" : "🙈";
            };
        }
        if (input) {
            input.onkeydown = function (event) {
                if (event.key === "Enter") { event.preventDefault(); if (unlockButton) unlockButton.click(); }
            };
        }
        if (unlockButton) {
            unlockButton.onclick = function () { if (bypassRunning) return; startNewBypass(); };
        }
    }

    function ensureOverlay() {
        if (manuallyClosed || rebuilding) return;
        rebuilding = true;
        try {
            ensureStyle();
            let existing = document.getElementById(OVERLAY_ID);
            if (!existing) {
                existing = createOverlay();
                (document.documentElement || document.body).appendChild(existing);
            }
            overlay = existing;
            cacheElements();
            ensureProgressBar();
            protectOverlay();
            attachEvents();
            restoreState();
        } finally { rebuilding = false; }
    }

    function updateStatus(text) {
        if (statusElement) statusElement.textContent = text;
        setState({ status: text });
    }

    function getSessionInfo(callback) {
        const url = "/api/session-info";
        console.log("[AINCRAD] GET", location.origin + url);
        fetch(url, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "*/*" } })
            .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
            .then(function (data) { console.log("[AINCRAD] session:", data); callback(data); })
            .catch(function (error) { console.error("[AINCRAD] session error:", error); updateStatus("Erro ao obter sessão"); callback(null); });
    }

    function callNextStage(token, stageId, progress, callback) {
        const inputData = { "0": { json: { token: token, progress: progress, stageId: stageId } } };
        const encodedInput = encodeURIComponent(JSON.stringify(inputData));
        const url = "/api/trpc/linkSession.nextStage" + "?batch=1&input=" + encodedInput;
        console.log("[AINCRAD] nextStage:", progress);
        fetch(url, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "*/*" } })
            .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.text(); })
            .then(function (text) {
                let body = null;
                try { body = JSON.parse(text); } catch (error) { console.warn("[AINCRAD] Resposta não JSON:", text); callback(null); return; }
                const destination = body?.[0]?.result?.data?.json?.destinationLink;
                callback(typeof destination === "string" ? destination : null);
            })
            .catch(function (error) { console.error("[AINCRAD] nextStage error:", error); callback(null); });
    }

    function updateStage(current, total) {
        showBypassUI();
        renderStage(current, total, "Processando...");
        setState({ active: true, running: true, dismissed: false, completed: false, currentStage: current, totalStages: total, status: "Processando..." });
        console.log("[AINCRAD] FASE " + current + "/" + total);
    }

    function processAllStages(session) {
        if (!session || session.hasSession !== true || typeof session.sessionToken !== "string" || !session.sessionToken ||
            typeof session.stageId !== "number" || typeof session.stageNumber !== "number" ||
            typeof session.totalStage !== "number" || session.totalStage < 1) {
            updateStatus("Sessão inválida");
            console.error("[AINCRAD] Sessão inválida:", session);
            startedThisPage = false;
            return;
        }
        const token = session.sessionToken;
        const stageId = session.stageId;
        const initialStage = session.stageNumber;
        const totalStages = session.totalStage;
        bypassRunning = true;
        startedThisPage = true;
        setState({ active: true, running: true, dismissed: false, completed: false, currentStage: initialStage, totalStages: totalStages, status: "Processando..." });
        showBypassUI();
        let progress = initialStage + 1;
        function next() {
            if (manuallyClosed) return;
            const visibleStage = Math.min(progress, totalStages);
            updateStage(visibleStage, totalStages);
            callNextStage(token, stageId, progress, function (destination) {
                if (manuallyClosed) return;
                if (typeof destination === "string" && /^https?:\/\//i.test(destination)) {
                    redirectToFinalUrl(destination);
                    return;
                }
                if (progress < totalStages + 1) { progress++; next(); return; }
                bypassRunning = false; startedThisPage = false;
                setState({ active: false, running: false, currentStage: null, totalStages: null, status: "Não foi possível concluir" });
                showIdleUI();
                if (errorElement) errorElement.textContent = "Não foi possível concluir.";
            });
        }
        next();
    }

    function runBypass() {
        if (startedThisPage) return;
        startedThisPage = true;
        showBypassUI();
        updateStatus("Obtendo sessão...");
        getSessionInfo(function (session) {
            if (!session) { startedThisPage = false; showIdleUI(); return; }
            processAllStages(session);
        });
    }

    function startNewBypass() {
        manuallyClosed = false; startedThisPage = false; bypassRunning = false; finalUrl = null;
        clearState();
        setState({ active: true, running: false, dismissed: false, completed: false, currentStage: null, totalStages: null, finalUrl: null, status: "Obtendo sessão..." });
        runBypass();
    }

	// auto-run: corrije isso depois: 
	startNewBypass()

    function autoResume() {
        if (manuallyClosed || startedThisPage) return;
        const state = getState();
        console.log("[AINCRAD] Estado:", state);
        if (state.dismissed) { showIdleUI(); return; }
        if (state.completed) { showIdleUI(); return; }
        if (!state.active) { showIdleUI(); return; }
        console.log("[AINCRAD] AUTO RESUME:", location.origin);
        runBypass();
    }

    function redirectToFinalUrl(url) {
        if (!url) return;
        finalUrl = url;
        const state = getState();
        setState({ active: false, running: false, dismissed: false, completed: true, finalUrl: url,
            currentStage: state.totalStages || state.currentStage || null, totalStages: state.totalStages || null, status: "Destino encontrado" });
        if (stageText) stageText.textContent = "Link encontrado";
        if (statusElement) statusElement.textContent = "Abrindo destino...";
        const progressBar = overlay?.querySelector("#aincrad-stage-progress-bar");
        if (progressBar) { progressBar.style.width = "100%"; progressBar.style.background = "#22c55e"; }
        console.log("[AINCRAD] DESTINO:", url);
        // Notifica Electron ANTES de navegar
        if (window.__AINCRAD_NOTIFY_DESTINO__) {
            window.__AINCRAD_NOTIFY_DESTINO__(url);
        }
        setTimeout(function () { location.replace(url); }, 500);
    }

    function startWatchdog() {
        if (watchdog) return;
        watchdog = setInterval(function () {
            if (manuallyClosed) return;
            const current = document.getElementById(OVERLAY_ID);
            if (!current) { ensureOverlay(); return; }
            overlay = current; protectOverlay();
        }, 700);
    }

    function startObserver() {
        if (observer || !document.documentElement) return;
        observer = new MutationObserver(function () {
            if (rebuilding || manuallyClosed) return;
            const current = document.getElementById(OVERLAY_ID);
            if (!current) ensureOverlay();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function initialize() {
        ensureStyle(); ensureOverlay(); startObserver(); startWatchdog();
        setTimeout(function () { ensureOverlay(); autoResume(); }, 300);
        setTimeout(function () { autoResume(); }, 1200);
        console.log("[AINCRAD] v6 ativo em:", location.origin);
    }

    if (document.documentElement) { initialize(); }
    else {
        const initObserver = new MutationObserver(function () {
            if (document.documentElement) { initObserver.disconnect(); initialize(); }
        });
        initObserver.observe(document, { childList: true, subtree: true });
    }
})();