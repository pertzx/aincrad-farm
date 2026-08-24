/*

ESSE CODIGO TA MUITO BOM, SO QUE A BUSCA POR BOTOES TA RUIM E NAO FUNCIONA DIREITO
FAÇA O SEGUINTE 1. BUSQUE TODOS TEXTOS EM BOTOES OU ELEMENTOS QUE LEVAM A LINKS
2. ARMAZENA ESSAS STRINGS E PRA CADA LETRA DA STRING, VÊ SE TEM ALGUM CARACTERE NO ALFABETO E SE TIVER VE DE QUAL LETRA ESSE CARACTERE SE REFERENCIA, AI NA ORDEM VAI ARMAZENANDO OS CARACTERES DEOBFUSCADOS.
3. QUANDO TERMINAR COMPARA COM AS BUSCAS E VÊ QUAL MAIS SE PARECE E DA UM SCORE DE COMPATIBILIDADE. ACHOQUE ASSIM É MAIS RAPIDO E MELHOR

*/

(function () {
    "use strict";

    // Intercepta window.open para detectar quando anúncio abre nova aba
    var __gs_lastOpenedUrl = null;
    var __gs_lastOpenTime = 0;
    var originalOpen = window.open;
    window.open = function (url, target, features) {
        if (url && typeof url === 'string') {
            __gs_lastOpenedUrl = url;
            __gs_lastOpenTime = Date.now();
            console.log("[GS] window.open detectado:", url);
            // Permite abrir (retorna originalOpen) para anúncios funcionarem
            return originalOpen.apply(window, arguments);
        }
        return originalOpen.apply(window, arguments);
    };

    const LOGO_URL = "https://raw.githubusercontent.com/robinhossainraaj/rorax-iptv-database/refs/heads/main/logo.png";
    const TELEGRAM_URL = "https://t.me/rorax_x";
    const OVERLAY_ID = "gs-bypass-overlay";
    const STYLE_ID = "gs-bypass-style";
    const STATE_KEY = "gs_bypass_state_v6";
    const CLICK_DELAY = 5000; // ms entre cliques/fases
    const AD_DELAY = 10000;   // ms após clicar no anúncio antes de tentar o botão
    const AD_SELECTORS = [
        '.ad-container',
        '[class*="ad-container"]',
        '[class*="advertisement"]',
        '[class*="ads"]',
        '[id*="ad-container"]',
        '[id*="advertisement"]',
        '.ad',
        '.ads',
        '.advert',
        '.banner-ad',
        '[data-ad]',
        'iframe[src*="ad"]',
        'iframe[src*="ads"]'
    ];
    const HOST = location.hostname.toLowerCase();

    const SUPPORTED_ROOTS = [
        "alpharede.com", "rodaemotor.com", "guis2.com",
        "horoscopeonday.com", "forumdinheiro.com",
        "milbviral.com", "tarviral.com", "gsmods.com"
    ];

    function isSupportedHost(host) {
        return SUPPORTED_ROOTS.some(function (root) {
            return host === root || host.endsWith("." + root);
        });
    }

    if (!isSupportedHost(HOST)) return;
    if (window !== window.top) return;
    if (window.__GS_BYPASS_V6__) return;
    window.__GS_BYPASS_V6__ = true;

    // ===== STATE =====
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
        } catch (e) { }
    }
    function clearState() {
        try { localStorage.removeItem(STATE_KEY); } catch (e) { }
    }

    // ===== NOTIFICA ELECTRON =====
    function notifyStatus(msg) {
        console.log('[GS]', msg);
        if (window.__GS_NOTIFY_STATUS__) window.__GS_NOTIFY_STATUS__(msg);
    }
    function notifyPhase(current, total) {
        if (window.__GS_NOTIFY_PHASE__) window.__GS_NOTIFY_PHASE__(current, total);
    }
    function notifyDestino(url) {
        if (window.__GS_NOTIFY_DESTINO__) window.__GS_NOTIFY_DESTINO__(url);
    }

    // ===== ALFABETO / CHAR_MAP (corrigido, sem chaves duplicadas) =====
    const CHAR_MAP = {
        'A':'A','a':'A','4':'A','@':'A','Δ':'A','Λ':'A','Â':'A','Ã':'A','Ä':'A','À':'A','Á':'A','Å':'A','Æ':'A',
        'B':'B','b':'B','8':'B','ß':'B','β':'B','Б':'B',
        'C':'C','c':'C','(':'C','[':'C','{':'C','©':'C','¢':'C','Ç':'C',
        'D':'D','d':'D','Ð':'D','Đ':'D',
        'E':'E','e':'E','3':'E','€':'E','£':'E','Ê':'E','Ë':'E','É':'E','È':'E',
        'F':'F','f':'F','ƒ':'F',
        'G':'G','g':'G','9':'G','ğ':'G',
        'H':'H','h':'H','#':'H','Ħ':'H','Ĥ':'H',
        'I':'I','i':'I','1':'I','!':'I','|':'I','Î':'I','Ï':'I','Í':'I','Ì':'I','İ':'I','ı':'I',
        'J':'J','j':'J',
        'K':'K','k':'K','ĸ':'K','κ':'K',
        'L':'L','l':'L','Ĺ':'L','Ļ':'L','Ľ':'L',
        'M':'M','m':'M','Μ':'M','м':'M',
        'N':'N','n':'N','∩':'N','Π':'N','Ñ':'N','Ń':'N','ń':'N',
        'O':'O','o':'O','0':'O','Ø':'O','°':'O','º':'O','Ô':'O','Ö':'O','Ò':'O','Ó':'O','Õ':'O',
        'P':'P','p':'P','¶':'P','þ':'P','Þ':'P','ρ':'P',
        'Q':'Q','q':'Q',
        'R':'R','r':'R','®':'R','Я':'R','Ř':'R','ř':'R',
        'S':'S','s':'S','5':'S','$':'S','§':'S','Ś':'S','ś':'S','Š':'S','š':'S',
        'T':'T','t':'T','7':'T','+':'T','†':'T','Ť':'T','ť':'T',
        'U':'U','u':'U','µ':'U','Û':'U','Ü':'U','Ù':'U','Ú':'U','Ů':'U',
        'V':'V','v':'V','ν':'V',
        'W':'W','w':'W','ω':'W','Ŵ':'W','ŵ':'W',
        'X':'X','x':'X','×':'X','Χ':'X',
        'Y':'Y','y':'Y','¥':'Y','Ý':'Y','ý':'Y','ÿ':'Y',
        'Z':'Z','z':'Z','2':'Z','Ž':'Z','ž':'Z',
        '_':' ','-':' ','.':' ','·':' ','•':' ',' ':' '
    };

    const KEYWORDS = [
        'CONTINUAR','AVANCAR','AVANÇAR','PROXIMO','PRÓXIMO','PROXIMA','PRÓXIMA',
        'CLIQUE NO LINK','CLIQUE PARA CONTINUAR','CONTINUE','NEXT',
        'CONTINUAR PARA O LINK','IR PARA O LINK','ABRIR LINK',
        'GET LINK','GO TO LINK','CLICK HERE',
        'CONTINUAR LINK','ACESSAR','ACESSAR LINK','CONTINUAR AGORA','CONTINUAR PARA',
        'PROSSEGUIR'
    ];

    const NEGATIVE_KEYWORDS = [
        'PRIVACY','POLICY','POLITICA','POLÍTICA','TERMOS','TERMS',
        'CONTACT','CONTATO','ABOUT','SOBRE','HELP','AJUDA','FAQ',
        'SUPPORT','SUPORTE','COPYRIGHT','DIREITOS','DMCA',
        'DISCLAIMER','HOME','INICIO','INÍCIO',
        'LOGIN','REGISTER','SUBSCRIBE','SETTINGS','CONFIG','CONFIGURACAO',
        'BACK','VOLTAR','RETURN','MENU','SEARCH','BUSCAR'
    ];

    const FOOTER_TERMS = ['terms', 'termos', 'privacy', 'privacidade', 'policy', 'politica', 'política',
        'contact', 'contato', 'about', 'sobre', 'help', 'ajuda', 'faq', 'support', 'suporte',
        'copyright', 'direitos', 'dmca', 'disclaimer', 'cookie', 'cookies', 'home', 'inicio', 'INICIAR BYPASS'];

    // ===== DEOBFUSCAÇÃO (caractere por caractere) =====
    function deobfuscate(str) {
        if (!str) return '';
        var out = '';
        for (var i = 0; i < str.length; i++) {
            var mapped = CHAR_MAP[str[i]];
            out += mapped !== undefined ? mapped : str[i];
        }
        return out
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ===== MATCH SEQUENCIAL (respeita ORDEM dos caracteres) =====
    function sequentialMatch(text, keyword) {
        var t = text;
        var k = keyword;
        var i = 0, j = 0, matches = 0, gaps = 0;
        var maxLen = Math.max(t.length, k.length);
        if (maxLen === 0) return 0;

        while (i < t.length && j < k.length) {
            if (t[i] === k[j]) {
                matches++;
                i++;
                j++;
            } else {
                var found = false;
                var lookahead = Math.min(3, t.length - i);
                for (var g = 1; g <= lookahead; g++) {
                    if (t[i + g] === k[j]) {
                        gaps += g;
                        i += g + 1;
                        matches++;
                        j++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var lookkw = Math.min(3, k.length - j);
                    for (var g = 1; g <= lookkw; g++) {
                        if (t[i] === k[j + g]) {
                            gaps += g;
                            j += g + 1;
                            matches++;
                            i++;
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    i++;
                    j++;
                }
            }
        }

        var gapPenalty = gaps * 0.03;
        var score = (matches / maxLen) - gapPenalty;
        return Math.max(0, Math.min(1, score));
    }

    // ===== SCORE MATCH =====
    function scoreMatch(deobf) {
        if (!deobf || deobf.length < 2) return { score: 0, pct: 0, keyword: '' };

        // Rejeita se contém palavra negativa
        for (var n = 0; n < NEGATIVE_KEYWORDS.length; n++) {
            if (deobf.indexOf(NEGATIVE_KEYWORDS[n]) !== -1) {
                return { score: 0, pct: 0, keyword: '' };
            }
        }

        var bestScore = 0;
        var bestKeyword = '';

        for (var k = 0; k < KEYWORDS.length; k++) {
            var kw = KEYWORDS[k].toUpperCase();
            var score = 0;

            if (deobf === kw) {
                score = 1.0;
            } else if (kw.indexOf(deobf) !== -1 && deobf.length >= 4) {
                // Texto é substring da keyword → score proporcional ao tamanho
                var ratio = deobf.length / kw.length;
                score = 0.94 * ratio;
            } else if (deobf.indexOf(kw) !== -1) {
                // Keyword completa está dentro do texto
                score = 0.98;
            } else {
                // Match sequencial (respeita ORDEM)
                score = sequentialMatch(deobf, kw);
                if (deobf.length > 0 && kw.length > 0 && deobf[0] === kw[0]) {
                    score = Math.min(1, score + 0.03);
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestKeyword = KEYWORDS[k];
            }
        }

        return { score: bestScore, pct: Math.round(bestScore * 100), keyword: bestKeyword };
    }

    function normalize(str) {
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[_\-\.·•]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isInFooter(el) {
        var node = el;
        while (node && node !== document.body) {
            var tag = (node.tagName || '').toLowerCase();
            var cls = (node.className || '').toLowerCase();
            var id = (node.id || '').toLowerCase();
            if (tag === 'footer' || tag === 'nav' || tag === 'aside') return true;
            if (cls.indexOf('footer') !== -1 || cls.indexOf('nav') !== -1 || cls.indexOf('sidebar') !== -1 || cls.indexOf('menu') !== -1 || cls.indexOf('bottom') !== -1) return true;
            if (id.indexOf('footer') !== -1 || id.indexOf('nav') !== -1 || id.indexOf('sidebar') !== -1 || id.indexOf('menu') !== -1) return true;
            node = node.parentElement;
        }
        return false;
    }

    function isFooterText(text) {
        var nt = normalize(text);
        for (var i = 0; i < FOOTER_TERMS.length; i++) {
            if (nt.indexOf(FOOTER_TERMS[i].toUpperCase()) !== -1) return true;
        }
        return false;
    }

    function isVisible(el) {
        if (!el) return false;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
    }

    function isCenterScreen(el) {
        var rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.85;
    }

    function getElementDepth(el) {
        var depth = 0, node = el;
        while (node && node !== document.body) { depth++; node = node.parentElement; }
        return depth;
    }

    function getElementSearchText(el) {
        var values = [
            el.innerText,
            el.value,
            el.getAttribute('aria-label'),
            el.getAttribute('title'),
            el.getAttribute('data-label'),
            el.getAttribute('data-text'),
            el.getAttribute('data-value'),
            el.placeholder
        ];

        var filtered = [];
        for (var i = 0; i < values.length; i++) {
            if (values[i]) {
                var s = String(values[i]).replace(/\s+/g, ' ').trim();
                if (s) filtered.push(s);
            }
        }

        filtered.sort(function(a, b) { return a.length - b.length; });
        return filtered[0] || '';
    }

    // ===== SCANNER (motor v3) =====
    function scanButtons() {
        var selectors = 'button, a, input[type="button"], input[type="submit"], [role="button"], [onclick], [class*="button"], [class*="btn"]';
        var elements = [];

        document.querySelectorAll(selectors).forEach(function (el) {
            if (isInFooter(el)) return;
            // if (!isVisible(el)) return;

            var raw = getElementSearchText(el);
            if (!raw || raw.length < 2 || raw.length > 100) return;
            if (isFooterText(raw)) return;

            var deobf = deobfuscate(raw);
            var match = scoreMatch(deobf);
            console.log(`RAW: ${raw}; DEOBF: ${deobf}; ${match.pct}%}`)
            if (match.pct < 0.60) return;

            var tag = el.tagName.toLowerCase();
            var typeBonus = 0;
            if (tag === 'button' || tag === 'input') typeBonus = 0.06;
            else if (el.getAttribute('role') === 'button') typeBonus = 0.04;

            var posBonus = isCenterScreen(el) ? 0.04 : 0;

            var href = (el.getAttribute('href') || '').toLowerCase();
            var hrefBonus = 0;
            if (href) {
                try {
                    var linkHost = new URL(href, location.href).hostname.toLowerCase();
                    if (!isSupportedHost(linkHost)) hrefBonus = 0.08;
                    else if (href.indexOf('redirect') !== -1 || href.indexOf('next') !== -1 || href.indexOf('go') !== -1) hrefBonus = 0.04;
                } catch (e) {}
            }

            var childPenalty = el.children.length > 3 ? -0.04 : 0;

            var finalScore = Math.min(
                1.0,
                Math.max(
                    0,
                    match.score +
                    typeBonus +
                    posBonus +
                    hrefBonus +
                    childPenalty
                )
            );

            console.log(`Score: ${finalScore}`);

            if (finalScore >= 0.65) {
                elements.push({
                    el: el,
                    text: raw,
                    deobf: deobf,
                    score: finalScore,
                    pct: match.pct,
                    textScore: match.score,
                    keyword: match.keyword,
                    href: href,
                    tag: tag
                });
            }
        });

        return elements.sort(function (a, b) {
            if (Math.abs(b.score - a.score) > 0.05) return b.score - a.score;
            return getElementDepth(a.el) - getElementDepth(b.el);
        });
    }

    // ===== ENABLE BUTTON (remove disabled) =====
    function enableButton(el) {
        if (!el) return;
        // Remove atributo disabled
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        // Remove classes comuns de disabled
        var disabledClasses = ['disabled', 'btn-disabled', 'button-disabled', 'is-disabled', 'inactive', 'not-active'];
        var cls = (el.className || '').toLowerCase();
        for (var i = 0; i < disabledClasses.length; i++) {
            if (cls.indexOf(disabledClasses[i]) !== -1) {
                el.classList.remove(disabledClasses[i]);
            }
        }
        // Força pointer-events e opacity
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('cursor', 'pointer', 'important');
        // Remove event listeners de bloqueio (sobrescreve onclick vazio)
        if (typeof el.onclick === 'function' && el.onclick.toString().indexOf('disabled') !== -1) {
            el.onclick = null;
        }
    }

    // ===== ANÚNCIOS =====
    function findNearestAd(targetEl) {
        // PRIORIDADE 1: .ad-container exato → pega o IFRAME dentro
        var containers = document.querySelectorAll('.ad-container');
        console.log('[GS] .ad-container encontrados:', containers.length);

        var candidates = [];
        for (var c = 0; c < containers.length; c++) {
            var ifr = containers[c].querySelector('iframe');
            if (ifr) {
                candidates.push(ifr);
            } else {
                candidates.push(containers[c]);
            }
        }

        // Se não achou .ad-container, procura iframes soltos que pareçam anúncios
        if (candidates.length === 0) {
            var allIframes = document.querySelectorAll('iframe');
            for (var i = 0; i < allIframes.length; i++) {
                var src = (allIframes[i].src || '').toLowerCase();
                var parent = allIframes[i].parentElement;
                var parentCls = parent ? (parent.className || '').toLowerCase() : '';
                if (src.indexOf('google') !== -1 || src.indexOf('doubleclick') !== -1 ||
                    parentCls.indexOf('ad') !== -1) {
                    candidates.push(allIframes[i]);
                }
            }
        }

        if (candidates.length === 0) {
            console.log('[GS] Nenhum anúncio/iframe encontrado');
            return null;
        }

        var targetRect = targetEl.getBoundingClientRect();
        var targetCX = targetRect.left + targetRect.width / 2;
        var targetCY = targetRect.top + targetRect.height / 2;
        var best = null;
        var bestDist = Infinity;

        for (var i = 0; i < candidates.length; i++) {
            var ad = candidates[i];
            if (ad === targetEl) continue;
            if (ad.contains && ad.contains(targetEl)) continue;
            if (targetEl.contains && targetEl.contains(ad)) continue;

            var adRect = ad.getBoundingClientRect();
            if (adRect.width === 0 || adRect.height === 0) continue;

            var adCX = adRect.left + adRect.width / 2;
            var adCY = adRect.top + adRect.height / 2;
            var dx = targetCX - adCX;
            var dy = targetCY - adCY;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < bestDist) {
                bestDist = dist;
                best = ad;
            }
        }

        if (best) {
            console.log('[GS] Elemento mais próximo:', best.tagName, best.className || best.id || '', 'dist:', Math.round(bestDist));
        }

        return (best && bestDist < 600) ? best : null;
    }

    function highlightAd(el, duration) {
        if (!el) return;
        el.classList.add('gs-ad-highlight');
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}
        if (duration > 0) {
            setTimeout(function () {
                try { el.classList.remove('gs-ad-highlight'); } catch (e) {}
            }, duration);
        }
    }

    function removeAdHighlight(el) {
        if (!el) return;
        try { el.classList.remove('gs-ad-highlight'); } catch (e) {}
    }

    function clickAdContainer(adEl, callback) {
        if (!adEl) {
            if (callback) callback(false);
            return;
        }

        var startUrl = location.href;
        var openBefore = __gs_lastOpenTime;

        highlightAd(adEl, 3000);
        addFeedback('<span class="warn">🎯 Clicando em anúncio próximo...</span>');

        // Garante que o elemento está clicável
        try {
            adEl.style.setProperty('pointer-events', 'auto', 'important');
            adEl.style.setProperty('z-index', '9999', 'important');
        } catch (e) {}

        // Se for IFRAME, clica nele diretamente (o iframe em si é o anúncio)
        if (adEl.tagName === 'IFRAME') {
            console.log('[GS] Alvo é IFRAME, clicando diretamente');
            try {
                // Tenta clicar no iframe via MouseEvent nas coordenadas dele
                var rect = adEl.getBoundingClientRect();
                var cx = rect.left + rect.width / 2;
                var cy = rect.top + rect.height / 2;

                ['mousedown', 'mouseup', 'click'].forEach(function (type) {
                    var ev = new MouseEvent(type, {
                        bubbles: true, cancelable: true, view: window,
                        clientX: cx, clientY: cy
                    });
                    adEl.dispatchEvent(ev);
                });

                adEl.click();
                adEl.focus();

                // Tenta tecla Enter
                var kd = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                var ku = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });
                adEl.dispatchEvent(kd);
                adEl.dispatchEvent(ku);

                console.log('[GS] Eventos disparados no iframe');
            } catch (e) {
                console.log('[GS] Erro no iframe:', e);
            }
        }

        // Se for DIV/container, procura iframe dentro e clica no wrapper
        if (adEl.tagName !== 'IFRAME') {
            var iframe = adEl.querySelector('iframe');
            if (iframe) {
                console.log('[GS] Container tem iframe dentro');
                try {
                    iframe.style.setProperty('pointer-events', 'auto', 'important');
                    iframe.click();
                    iframe.focus();
                } catch (e) {}
            }

            // Também procura <a> direto no container
            var link = adEl.querySelector('a[href]');
            if (link) {
                console.log('[GS] Link no container:', link.href);
                try {
                    link.click();
                    window.open(link.href, '_blank');
                } catch (e) {}
            }
        }

        // Clica no centro do elemento (independente do tipo)
        try {
            var rect2 = adEl.getBoundingClientRect();
            var cx2 = rect2.left + rect2.width / 2;
            var cy2 = rect2.top + rect2.height / 2;
            var elAtPoint = document.elementFromPoint(cx2, cy2);
            if (elAtPoint && elAtPoint !== document.body) {
                elAtPoint.click();
                console.log('[GS] elementFromPoint clicou em:', elAtPoint.tagName);
            }
        } catch (e) {}

        // Detecta se anúncio abriu (nova aba OU redirecionamento)
        setTimeout(function () {
            var adOpened = (__gs_lastOpenTime > openBefore) || (location.href !== startUrl);
            console.log('[GS] Anúncio abriu?', adOpened, 'href mudou:', location.href !== startUrl);
            removeAdHighlight(adEl);
            if (adOpened) {
                addFeedback('<span class="ok">✓ Anúncio abriu!</span>');
            }
            if (callback) callback(adOpened);
        }, 1200);
    }

        // ===== CONTAGEM REGRESSIVA =====
    function countdown(seconds, label, onTick, onDone) {
        var remaining = seconds;
        addFeedback('<span class="warn">⏳ ' + label + ' ' + remaining + 's</span>');
        var timer = setInterval(function () {
            remaining--;
            if (remaining > 0) {
                if (onTick) onTick(remaining);
            } else {
                clearInterval(timer);
                if (onDone) onDone();
            }
        }, 1000);
        return timer;
    }

        // ===== HIGHLIGHT VISUAL =====
    function highlightElement(el, duration) {
        if (!el) return;
        el.classList.add('gs-highlight');
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}
        if (duration > 0) {
            setTimeout(function () {
                try { el.classList.remove('gs-highlight'); } catch (e) {}
            }, duration);
        }
    }

    // ===== ANÚNCIOS =====
    function highlightAd(el) {
        if (!el) return;
        el.classList.add('gs-ad-highlight');
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) {}
    }

    function removeAdHighlight(el) {
        if (!el) return;
        try { el.classList.remove('gs-ad-highlight'); } catch (e) {}
    }

    function findAds() {
        var ads = [];
        for (var s = 0; s < AD_SELECTORS.length; s++) {
            try {
                var found = document.querySelectorAll(AD_SELECTORS[s]);
                for (var i = 0; i < found.length; i++) {
                    var el = found[i];
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        ads.push(el);
                    }
                }
            } catch (e) {}
        }
        // Remove duplicados
        var unique = [];
        for (var i = 0; i < ads.length; i++) {
            var dup = false;
            for (var j = 0; j < unique.length; j++) {
                if (ads[i] === unique[j]) { dup = true; break; }
            }
            if (!dup) unique.push(ads[i]);
        }
        return unique;
    }

    function clickAd(el, onComplete) {
        if (!el) {
            if (onComplete) onComplete(false);
            return;
        }
        highlightAd(el);
        addFeedback('<span class="warn">🎯 Clicando no anúncio para desbloquear...</span>');

        // Guarda URL atual pra detectar se abriu anúncio
        var startUrl = location.href;
        var adWindow = null;

        // Tenta clicar no link dentro do anúncio
        var adLink = el.querySelector('a[href], [onclick]');
        var target = adLink || el;

        ['mousedown', 'mouseup', 'click'].forEach(function (type) {
            try {
                var ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                target.dispatchEvent(ev);
            } catch (e) {}
        });

        try {
            target.click();
        } catch (e) {}

        // Se abriu nova janela, guarda referência
        if (target.tagName === 'A' && target.href && target.target === '_blank') {
            adWindow = window.open(target.href, '_blank');
        }

        // Espera o delay do anúncio
        setTimeout(function () {
            removeAdHighlight(el);
            if (onComplete) onComplete(true);
        }, AD_DELAY);
    }

    function removeHighlight(el) {
        if (!el) return;
        try { el.classList.remove('gs-highlight'); } catch (e) {}
    }

    // ===== CLICK COM TIMEOUT DE PROTEÇÃO =====
    function smartClick(item, onComplete) {
        if (!item || !item.el) {
            if (onComplete) onComplete(false);
            return false;
        }

        var el = item.el;
        var startUrl = location.href;
        var clicked = false;

        // Habilita o botão (remove disabled)
        enableButton(el);

        // Destaque visual antes do clique
        highlightElement(el, 2000);

        // Dispara eventos de mouse
        ['mousedown', 'mouseup', 'click'].forEach(function (type) {
            try {
                var ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                el.dispatchEvent(ev);
            } catch (e) {}
        });

        // Clica no elemento
        try {
            el.click();
            clicked = true;
        } catch (e) {
            removeHighlight(el);
            if (onComplete) onComplete(false);
            return false;
        }

        // Se for link <A>, tenta navegar
        if (el.tagName === 'A' && el.href) {
            setTimeout(function () {
                if (!window.__GS_STOP_NAV__) {
                    try { location.href = el.href; } catch (e) {}
                }
            }, 300);
        }

        // TIMEOUT DE PROTEÇÃO: se a URL não mudou em 3s, considera que o clique não funcionou
        setTimeout(function () {
            removeHighlight(el);
            if (onComplete) {
                // Se a URL mudou, sucesso. Senão, falha.
                var urlChanged = location.href !== startUrl;
                onComplete(urlChanged);
            }
        }, 3000);

        return clicked;
    }

    // ===== UI =====
    let overlay = null, observer = null, watchdog = null, rebuilding = false;
    let manuallyClosed = false, bypassRunning = false, startedThisPage = false;
    let logoImage = null, logoContainer = null, input = null, unlockButton = null, errorElement = null;
    let eyeButton = null, circleSection = null, stageText = null, statusElement = null;
    let inputLabel = null, inputWrapper = null, closeButton = null;

    const STYLE_TEXT = `
        @keyframes gsSlide { from { opacity:0; transform:translateY(8px);} to { opacity:1; transform:translateY(0);} }
        @keyframes gsPulseSmall { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,.25);} 50% { box-shadow:0 0 0 5px rgba(220,38,38,0);} }
        #gs-bypass-overlay { position:fixed !important; right:18px !important; bottom:18px !important; top:auto !important; left:auto !important;
            width:auto !important; height:auto !important; z-index:2147483647 !important; display:flex !important;
            background:transparent !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
            pointer-events:none !important; visibility:visible !important; opacity:1 !important;
            font-family:'Rajdhani',Arial,sans-serif !important; isolation:isolate !important; }
        #gs-bypass-box { position:relative !important; width:280px !important; box-sizing:border-box !important; padding:12px !important;
            border:1px solid rgba(255,255,255,.08) !important; border-radius:14px !important;
            background:rgba(12,12,20,.94) !important; box-shadow:0 10px 30px rgba(0,0,0,.35) !important;
            backdrop-filter:blur(12px) !important; -webkit-backdrop-filter:blur(12px) !important;
            z-index:2147483647 !important; pointer-events:auto !important; visibility:visible !important; opacity:1 !important;
            animation:gsSlide .2s ease; }
        #gs-logo-wrap { display:flex !important; align-items:center !important; flex-direction:row !important; gap:9px !important; margin:0 !important; padding:0 !important; }
        #gs-logo { width:34px !important; height:34px !important; flex:0 0 34px !important; border-radius:9px !important;
            overflow:hidden !important; border:1px solid rgba(220,38,38,.22) !important; margin:0 !important;
            animation:gsPulseSmall 2.5s infinite !important; }
        #gs-logo img { width:100% !important; height:100% !important; object-fit:cover !important; display:block !important; }
        #gs-title { color:#fff !important; font-size:13px !important; font-weight:700 !important; line-height:1.1 !important; text-align:left !important; }
        #gs-subtitle { margin-top:2px !important; color:rgba(220,38,38,.65) !important; font-size:8px !important; letter-spacing:2px !important; text-align:left !important; }
        #gs-divider { height:1px !important; margin:10px 0 !important; background:rgba(255,255,255,.06) !important; }
        #gs-close { position:absolute !important; top:6px !important; right:7px !important; width:20px !important; height:20px !important;
            padding:0 !important; border:none !important; background:transparent !important; color:rgba(255,255,255,.25) !important;
            font-size:13px !important; line-height:20px !important; cursor:pointer !important; z-index:20 !important; }
        #gs-close:hover { color:rgba(255,255,255,.75) !important; }
        #gs-circle-section { display:none; width:100%; padding:0; flex-direction:column; align-items:center; }
        #gs-stage-text { margin:0 !important; color:#fff !important; font-size:12px !important; font-weight:700 !important;
            letter-spacing:1px !important; text-transform:none !important; text-align:left !important; }
        #gs-status { min-height:auto !important; margin-top:4px !important; color:rgba(255,255,255,.4) !important;
            font-size:10px !important; text-align:left !important; }
        #gs-stage-progress { display:block !important; width:100% !important; height:4px !important;
            margin-top:8px !important; border-radius:999px !important; background:rgba(255,255,255,.06) !important; overflow:hidden !important; }
        #gs-stage-progress-bar { width:0%; height:100%; border-radius:inherit; background:#dc2626;
            transition:width .25s ease,background .25s ease; }
        #gs-feedback { margin-top:6px !important; padding:6px 8px !important; border-radius:6px !important;
            background:rgba(59,130,246,.08) !important; border:1px solid rgba(59,130,246,.15) !important;
            font-size:10px !important; color:#60a5fa !important; line-height:1.4 !important; max-height:80px !important;
            overflow-y:auto !important; word-break:break-word !important; }
        #gs-feedback .ok { color:#22c55e !important; }
        #gs-feedback .warn { color:#f59e0b !important; }
        #gs-feedback .err { color:#ef4444 !important; }
        #gs-input-label { display:none !important; }
        #gs-input-wrapper { display:none !important; }
        #gs-error { min-height:auto !important; margin:5px 0 !important; color:#ef4444 !important;
            font-size:10px !important; text-align:center !important; }
        #gs-unlock-button { display:block; width:100% !important; padding:9px 12px !important; border:none !important;
            border-radius:8px !important; background:#dc2626 !important; color:#fff !important; font-size:11px !important;
            font-weight:700 !important; letter-spacing:1px !important; text-transform:uppercase !important; cursor:pointer !important;
            transition:opacity .15s,transform .15s !important; }
        #gs-unlock-button:hover { opacity:.9 !important; }
        #gs-unlock-button:active { transform:scale(.98) !important; }
        #gs-telegram { display:none !important; }
        @keyframes gsAdPulse { 0%,100% { outline:2px solid #f59e0b; outline-offset:2px; } 50% { outline:3px solid #fbbf24; outline-offset:4px; } }
        .gs-ad-highlight { animation:gsAdPulse 0.6s ease infinite !important; background:rgba(245,158,11,.15) !important; }
        @keyframes gsHighlightPulse { 0%,100% { outline:2px solid #dc2626; outline-offset:2px; } 50% { outline:3px solid #ff4444; outline-offset:4px; } }
        .gs-highlight { animation:gsHighlightPulse 0.6s ease 3 !important; background:rgba(220,38,38,.15) !important; }
        @keyframes gsAdPulse { 0%,100% { outline:2px solid #f59e0b; outline-offset:2px; } 50% { outline:3px solid #fbbf24; outline-offset:4px; } }
        .gs-ad-highlight { animation:gsAdPulse 0.5s ease 4 !important; background:rgba(245,158,11,.15) !important; }
        @media (max-width:600px) { #gs-bypass-overlay { right:10px !important; bottom:10px !important; }
            #gs-bypass-box { width:260px !important; } }
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
            <div id="gs-bypass-box">
                <button id="gs-close" type="button" aria-label="Fechar">✕</button>
                <div id="gs-logo-wrap">
                    <div id="gs-logo"><img src="${LOGO_URL}" id="gs-logo-image" alt=""></div>
                    <div><div id="gs-title">GS Bypass</div><div id="gs-subtitle">RORAX Edition</div></div>
                </div>
                <div id="gs-divider"></div>
                <div id="gs-circle-section">
                    <div id="gs-stage-text">Pronto para iniciar</div>
                    <div id="gs-status">Clique para continuar</div>
                    <div id="gs-stage-progress"><div id="gs-stage-progress-bar"></div></div>
                    <div id="gs-feedback"></div>
                </div>
                <label id="gs-input-label">Access Key</label>
                <div id="gs-input-wrapper">
                    <input id="gs-input" type="password" placeholder="Enter key to unlock">
                    <button id="gs-eye" type="button">👁</button>
                </div>
                <div id="gs-error"></div>
                <button id="gs-unlock-button" type="button">Iniciar Bypass</button>
                <a id="gs-telegram" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">t.me/rorax_x</a>
            </div>`;
        return element;
    }

    function cacheElements() {
        if (!overlay) return;
        logoImage = overlay.querySelector("#gs-logo-image");
        logoContainer = overlay.querySelector("#gs-logo");
        input = overlay.querySelector("#gs-input");
        unlockButton = overlay.querySelector("#gs-unlock-button");
        errorElement = overlay.querySelector("#gs-error");
        eyeButton = overlay.querySelector("#gs-eye");
        circleSection = overlay.querySelector("#gs-circle-section");
        stageText = overlay.querySelector("#gs-stage-text");
        statusElement = overlay.querySelector("#gs-status");
        inputLabel = overlay.querySelector("#gs-input-label");
        inputWrapper = overlay.querySelector("#gs-input-wrapper");
        closeButton = overlay.querySelector("#gs-close");
    }

    function protectOverlay() {
        if (!overlay) return;
        overlay.style.setProperty("position", "fixed", "important");
        overlay.style.setProperty("right", "18px", "important");
        overlay.style.setProperty("bottom", "18px", "important");
        overlay.style.setProperty("top", "auto", "important");
        overlay.style.setProperty("left", "auto", "important");
        overlay.style.setProperty("width", "auto", "important");
        overlay.style.setProperty("height", "auto", "important");
        overlay.style.setProperty("background", "transparent", "important");
        overlay.style.setProperty("backdrop-filter", "none", "important");
        overlay.style.setProperty("-webkit-backdrop-filter", "none", "important");
        overlay.style.setProperty("pointer-events", "none", "important");
        overlay.style.setProperty("z-index", "2147483647", "important");
        const box = overlay.querySelector("#gs-bypass-box");
        if (box) {
            box.style.setProperty("pointer-events", "auto", "important");
            box.style.setProperty("z-index", "2147483647", "important");
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
        const progressBar = overlay?.querySelector("#gs-stage-progress-bar");
        if (progressBar) { progressBar.style.width = "0%"; progressBar.style.background = "#dc2626"; }
        const fb = overlay?.querySelector("#gs-feedback");
        if (fb) fb.innerHTML = "";
    }

    function showBypassUI() {
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
        const progressBar = overlay?.querySelector("#gs-stage-progress-bar");
        if (progressBar) {
            progressBar.style.width = percentage + "%";
            progressBar.style.background = current >= total ? "#22c55e" : "#dc2626";
        }
        notifyPhase(current, total);
    }

    function addFeedback(html) {
        const fb = overlay?.querySelector("#gs-feedback");
        if (!fb) return;
        const line = document.createElement("div");
        line.innerHTML = html;
        fb.appendChild(line);
        fb.scrollTop = fb.scrollHeight;
    }

    function updateStatus(text) {
        if (statusElement) statusElement.textContent = text;
        setState({ status: text });
        notifyStatus(text);
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
                setState({ active: false, running: false, dismissed: true, completed: false, currentStage: null, totalStages: null, status: "" });
                if (overlay) overlay.remove();
                console.log("[GS] UI fechada.");
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
            protectOverlay();
            attachEvents();
            restoreState();
        } finally { rebuilding = false; }
    }

    // ===== API =====
    function getSessionInfo(callback) {
        const url = "/api/session-info";
        console.log("[GS] GET", location.origin + url);
        fetch(url, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "*/*" } })
            .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
            .then(function (data) { console.log("[GS] session:", data); callback(data); })
            .catch(function (error) { console.error("[GS] session error:", error); updateStatus("Erro ao obter sessão"); callback(null); });
    }

    function callNextStage(token, stageId, progress, callback) {
        const inputData = { "0": { json: { token: token, progress: progress, stageId: stageId } } };
        const encodedInput = encodeURIComponent(JSON.stringify(inputData));
        const url = "/api/trpc/linkSession.nextStage" + "?batch=1&input=" + encodedInput;
        console.log("[GS] nextStage:", progress);
        fetch(url, { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "*/*" } })
            .then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.text(); })
            .then(function (text) {
                let body = null;
                try { body = JSON.parse(text); } catch (error) { console.warn("[GS] Resposta não JSON:", text); callback(null); return; }
                const destination = body?.[0]?.result?.data?.json?.destinationLink;
                callback(typeof destination === "string" ? destination : null);
            })
            .catch(function (error) { console.error("[GS] nextStage error:", error); callback(null); });
    }

    // ===== INTERAÇÃO COM A PÁGINA (anúncios → botão, com timeout e highlight) =====
    function interactWithPage(callback) {
        var buttons = scanButtons();

        if (buttons.length === 0) {
            addFeedback('<span class="warn">⚠ Nenhum botão de avanço encontrado</span>');
            if (callback) callback(false);
            return false;
        }

        var best = buttons[0];
        addFeedback('<span class="ok">✓ Botão: "' + best.text.substring(0, 30) + '" [deobf: ' + best.deobf + '] (score ' + best.pct + '%)</span>');

        var maxCycles = 4;
        var cycle = 0;

        function runCycle() {
            if (manuallyClosed) { if (callback) callback(false); return; }
            cycle++;
            if (cycle > maxCycles) {
                addFeedback('<span class="err">✗ Máximo de ' + maxCycles + ' ciclos atingido</span>');
                if (callback) callback(false);
                return;
            }

            var fresh = scanButtons();
            var target = (fresh.length > 0) ? fresh[0] : best;

            var ad = findNearestAd(target.el);

            if (ad) {
                addFeedback('<span class="warn">🎯 Ciclo #' + cycle + ' — Anúncio encontrado, clicando...</span>');
                clickAdContainer(ad, function (adOpened) {
                    if (adOpened) {
                        countdown(5, 'Esperando pro botão desbloquear...', function (sec) {
                            addFeedback('<span class="warn">⏳ Esperando pro botão desbloquear... ' + sec + 's</span>');
                        }, function () {
                            tryButtonClick(target, function (worked) {
                                if (worked) {
                                    if (callback) callback(true);
                                } else {
                                    addFeedback('<span class="warn">⚠ Botão ainda travado, repetindo ciclo...</span>');
                                    setTimeout(runCycle, 1000);
                                }
                            });
                        });
                    } else {
                        addFeedback('<span class="warn">⚠ Anúncio não abriu — tentando botão direto</span>');
                        tryButtonClick(target, function (worked) {
                            if (worked) {
                                if (callback) callback(true);
                            } else {
                                setTimeout(runCycle, 1000);
                            }
                        });
                    }
                });
            } else {
                addFeedback('<span class="warn">⚠ Sem anúncio próximo — tentando botão direto</span>');
                tryButtonClick(target, function (worked) {
                    if (worked) {
                        if (callback) callback(true);
                    } else {
                        setTimeout(runCycle, 1000);
                    }
                });
            }
        }

        runCycle();
        return true;
    }

    function tryButtonClick(target, callback) {
        updateStatus('Clicando em botão de avanço...');
        smartClick(target.el, function (urlChanged) {
            if (urlChanged) {
                addFeedback('<span class="ok">✓ Botão funcionou!</span>');
                if (callback) callback(true);
            } else {
                addFeedback('<span class="warn">⚠ Clique no botão não gerou navegação</span>');
                if (callback) callback(false);
            }
        });
    }

        function updateStage(current, total) {
        showBypassUI();
        renderStage(current, total, "Processando...");
        setState({ active: true, running: true, dismissed: false, completed: false, currentStage: current, totalStages: total, status: "Processando..." });
        console.log("[GS] FASE " + current + "/" + total);
    }

    function processAllStages(session) {
        if (!session || session.hasSession !== true || typeof session.sessionToken !== "string" || !session.sessionToken ||
            typeof session.stageId !== "number" || typeof session.stageNumber !== "number" ||
            typeof session.totalStage !== "number" || session.totalStage < 1) {
            updateStatus("Sessão inválida");
            addFeedback('<span class="err">✗ Sessão inválida</span>');
            console.error("[GS] Sessão inválida:", session);
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

        // Limpa feedback
        const fb = overlay?.querySelector("#gs-feedback");
        if (fb) fb.innerHTML = "";

        let progress = initialStage + 1;

        function next() {
            if (manuallyClosed) return;

            const visibleStage = Math.min(progress, totalStages);
            updateStage(visibleStage, totalStages);
            addFeedback('▶ Chamando API (fase ' + visibleStage + '/' + totalStages + ')');

            callNextStage(token, stageId, progress, function (destination) {
                if (manuallyClosed) return;

                // PRIMEIRO: tenta interagir com a página (clique no botão — bônus pra contabilizar $$)
                var clicked = false;
                var interactionDone = false;

                interactWithPage(function (didClick) {
                    clicked = didClick;
                    interactionDone = true;
                });

                // SEGUNDO: se a API retornou um link, usa ele (principal)
                if (typeof destination === "string" && /^https?:\/\//i.test(destination)) {
                    addFeedback('<span class="ok">✓ API retornou link</span>');

                    // Verifica se é página final ou fase intermediária
                    try {
                        const destHost = new URL(destination).hostname.toLowerCase();
                        if (!isSupportedHost(destHost)) {
                            // PÁGINA FINAL
                            addFeedback('<span class="ok">✓ Link final detectado!</span>');
                            // redirectToFinalUrl(destination);
                            return;
                        }
                    } catch (e) { }

                    // FASE INTERMEDIÁRIA — não marca como completed
                    addFeedback('↻ Redirecionando para próxima fase...');
                    // Espera o delay configurável + tempo de interação
                    var waitTime = clicked ? CLICK_DELAY + 1000 : 1000;
                    setTimeout(function () {
                        location.replace(destination);
                    }, waitTime);
                    return;
                }

                // TERCEIRO: API não retornou link, tenta fallback pelo botão
                // Aguarda a interação terminar (máx 35s por causa do loop de anúncio)
                var fallbackTimer = setInterval(function () {
                    if (interactionDone || manuallyClosed) {
                        clearInterval(fallbackTimer);
                        if (manuallyClosed) return;

                        if (!clicked) {
                            addFeedback('<span class="err">✗ API não retornou link e botão não funcionou</span>');
                            updateStatus("API sem resposta — tentando fallback...");

                            // Fallback: tenta de novo
                            setTimeout(function () {
                                if (manuallyClosed) return;
                                interactWithPage(function (retryOk) {
                                    if (!retryOk) {
                                        addFeedback('<span class="err">✗ Fallback falhou</span>');
                                    }
                                });
                            }, 1500);

                            // Continua tentando próxima fase mesmo assim
                            if (progress < totalStages + 1) {
                                progress++;
                                addFeedback('⏳ Aguardando ' + (CLICK_DELAY / 1000) + 's antes da próxima fase...');
                                setTimeout(next, CLICK_DELAY);
                            }
                        } else {
                            // Clicou mas API não retornou link — continua para próxima fase
                            if (progress < totalStages + 1) {
                                progress++;
                                addFeedback('⏳ Aguardando ' + (CLICK_DELAY / 1000) + 's antes da próxima fase...');
                                setTimeout(next, CLICK_DELAY);
                            }
                        }
                    }
                }, 500);

                // Safety: se interactionDone nunca ficar true, força continuação em 35s
                setTimeout(function () {
                    clearInterval(fallbackTimer);
                    if (!interactionDone && !manuallyClosed && progress < totalStages + 1) {
                        progress++;
                        addFeedback('⏳ Safety: aguardando ' + (CLICK_DELAY / 1000) + 's...');
                        setTimeout(next, CLICK_DELAY);
                    }
                }, 35000);

                return; // Sai do callback early, o fallbackTimer continua, o fallbackTimer continua

                if (progress < totalStages + 1) {
                    progress++;
                    addFeedback('⏳ Aguardando ' + (CLICK_DELAY / 1000) + 's antes da próxima fase...');
                    setTimeout(next, CLICK_DELAY);
                    return;
                }

                // Acabou as fases mas não chegou no destino
                bypassRunning = false; startedThisPage = false;
                setState({ active: false, running: false, currentStage: null, totalStages: null, status: "Não foi possível concluir" });
                showIdleUI();
                addFeedback('<span class="err">✗ Não foi possível concluir</span>');
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
        manuallyClosed = false; startedThisPage = false; bypassRunning = false;
        clearState();
        setState({ active: true, running: false, dismissed: false, completed: false, currentStage: null, totalStages: null, finalUrl: null, status: "Obtendo sessão..." });
        runBypass();
    }

    startNewBypass();

    function autoResume() {
        if (manuallyClosed || startedThisPage) return;
        const state = getState();
        console.log("[GS] Estado:", state);
        if (state.dismissed) { showIdleUI(); return; }
        if (state.completed) { showIdleUI(); return; }
        if (!state.active) { showIdleUI(); return; }
        console.log("[GS] AUTO RESUME:", location.origin);
        runBypass();
    }

    function redirectToFinalUrl(url) {
        if (!url) return;
        setState({
            active: false, running: false, dismissed: false, completed: true, finalUrl: url,
            status: "Destino encontrado"
        });
        if (stageText) stageText.textContent = "Link encontrado";
        if (statusElement) statusElement.textContent = "Abrindo destino...";
        const progressBar = overlay?.querySelector("#gs-stage-progress-bar");
        if (progressBar) { progressBar.style.width = "100%"; progressBar.style.background = "#22c55e"; }
        addFeedback('<span class="ok">✓ DESTINO: ' + url.substring(0, 50) + '...</span>');
        console.log("[GS] DESTINO:", url);
        notifyDestino(url);
        setTimeout(function () { location.replace(url); }, 800);
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
        console.log("[GS] v6 + Motor v3 (ordem + %) ativo em:", location.origin);
    }

    if (document.documentElement) { initialize(); }
    else {
        const initObserver = new MutationObserver(function () {
            if (document.documentElement) { initObserver.disconnect(); initialize(); }
        });
        initObserver.observe(document, { childList: true, subtree: true });
    }
})();