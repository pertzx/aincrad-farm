(function () {
    "use strict";
    var __gs_lastOpenedUrl = null;
    var __gs_lastOpenTime = 0;
    var originalOpen = window.open;
    window.open = function (url, target, features) {
        if (url && typeof url === 'string') {
            __gs_lastOpenedUrl = url;
            __gs_lastOpenTime = Date.now();
            console.log("[GS] window.open detectado:", url);
            return originalOpen.apply(window, arguments);
        }
        return originalOpen.apply(window, arguments);
    };

    const LOGO_URL = "https://raw.githubusercontent.com/robinhossainraaj/rorax-iptv-database/refs/heads/main/logo.png";
    const TELEGRAM_URL = "https://t.me/rorax_x";
    const OVERLAY_ID = "gs-bypass-overlay";
    const STYLE_ID = "gs-bypass-style";
    const STATE_KEY = "gs_bypass_state_v6";
    const CLICK_DELAY = 5000;
    const HOST = location.hostname.toLowerCase();

    // API para o Electron ler a URL aberta
    window.__GS_GET_OPENED_URL__ = function () {
        if (__gs_lastOpenedUrl && (Date.now() - __gs_lastOpenTime) < 15000) {
            return __gs_lastOpenedUrl;
        }
        return null;
    };

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

    const CHAR_MAP = {
        'A': 'A', 'a': 'A', '4': 'A', '@': 'A', '\u0394': 'A', '\u039B': 'A', '\u00C2': 'A', '\u00C3': 'A', '\u00C4': 'A', '\u00C0': 'A', '\u00C1': 'A', '\u00C5': 'A', '\u00C6': 'A',
        'B': 'B', 'b': 'B', '8': 'B', '\u00DF': 'B', '\u03B2': 'B', '\u0411': 'B',
        'C': 'C', 'c': 'C', '(': 'C', '[': 'C', '{': 'C', '\u00A9': 'C', '\u00A2': 'C', '\u00C7': 'C',
        'D': 'D', 'd': 'D', '\u00D0': 'D', '\u0110': 'D',
        'E': 'E', 'e': 'E', '3': 'E', '\u20AC': 'E', '\u00A3': 'E', '\u00CA': 'E', '\u00CB': 'E', '\u00C9': 'E', '\u00C8': 'E',
        'F': 'F', 'f': 'F', '\u0192': 'F',
        'G': 'G', 'g': 'G', '9': 'G', '\u011F': 'G',
        'H': 'H', 'h': 'H', '#': 'H', '\u0126': 'H', '\u0124': 'H',
        'I': 'I', 'i': 'I', '1': 'I', '!': 'I', '|': 'I', '\u00CE': 'I', '\u00CF': 'I', '\u00CD': 'I', '\u00CC': 'I', '\u0130': 'I', '\u0131': 'I',
        'J': 'J', 'j': 'J',
        'K': 'K', 'k': 'K', '\u0138': 'K', '\u03BA': 'K',
        'L': 'L', 'l': 'L', '\u0139': 'L', '\u013B': 'L', '\u013D': 'L',
        'M': 'M', 'm': 'M', '\u039C': 'M', '\u043C': 'M',
        'N': 'N', 'n': 'N', '\u2229': 'N', '\u03A0': 'N', '\u00D1': 'N', '\u0143': 'N', '\u0144': 'N',
        'O': 'O', 'o': 'O', '0': 'O', '\u00D8': 'O', '\u00B0': 'O', '\u00BA': 'O', '\u00D4': 'O', '\u00D6': 'O', '\u00D2': 'O', '\u00D3': 'O', '\u00D5': 'O',
        'P': 'P', 'p': 'P', '\u00B6': 'P', '\u00FE': 'P', '\u00DE': 'P', '\u03C1': 'P',
        'Q': 'Q', 'q': 'Q',
        'R': 'R', 'r': 'R', '\u00AE': 'R', '\u042F': 'R', '\u0158': 'R', '\u0159': 'R',
        'S': 'S', 's': 'S', '5': 'S', '$': 'S', '\u00A7': 'S', '\u015A': 'S', '\u015B': 'S', '\u0160': 'S', '\u0161': 'S',
        'T': 'T', 't': 'T', '7': 'T', '+': 'T', '\u2020': 'T', '\u0164': 'T', '\u0165': 'T',
        'U': 'U', 'u': 'U', '\u00B5': 'U', '\u00DB': 'U', '\u00DC': 'U', '\u00D9': 'U', '\u00DA': 'U', '\u016E': 'U',
        'V': 'V', 'v': 'V', '\u03BD': 'V',
        'W': 'W', 'w': 'W', '\u03C9': 'W', '\u0174': 'W', '\u0175': 'W',
        'X': 'X', 'x': 'X', '\u00D7': 'X', '\u03A7': 'X',
        'Y': 'Y', 'y': 'Y', '\u00A5': 'Y', '\u00DD': 'Y', '\u00FD': 'Y', '\u00FF': 'Y',
        'Z': 'Z', 'z': 'Z', '2': 'Z', '\u017D': 'Z', '\u017E': 'Z',
        '_': ' ', '-': ' ', '.': ' ', '\u00B7': ' ', '\u2022': ' ', ' ': ' '
    };

    const KEYWORDS = [
        'CONTINUAR', 'AVANCAR', 'AVANCAR ETAPA', 'PROXIMO', 'PROXIMO', 'PROXIMA', 'PROXIMA',
        'CLIQUE NO LINK', 'CLIQUE PARA CONTINUAR', 'CONTINUE', 'NEXT',
        'CONTINUAR PARA O LINK', 'IR PARA O LINK', 'ABRIR LINK',
        'GET LINK', 'GO TO LINK', 'CLICK HERE', 'CLIQUE AQUI'
        'CONTINUAR LINK', 'ACESSAR', 'ACESSAR LINK', 'CONTINUAR AGORA', 'CONTINUAR PARA',
        'PROSSEGUIR', 'TOQUE NO BOTAO', 'APERTE NO BOTAO', 'TOQUE NO ANUNCIO', 'CLIQUE NO ANUNCIO', 'APERTE NO ANUNCIO'
    ];

    const NEGATIVE_KEYWORDS = [
        'PRIVACY', 'POLICY', 'POLITICA', 'POLITICA', 'TERMOS', 'TERMS',
        'CONTACT', 'CONTATO', 'ABOUT', 'SOBRE', 'HELP', 'AJUDA', 'FAQ',
        'SUPPORT', 'SUPORTE', 'COPYRIGHT', 'DIREITOS', 'DMCA',
        'DISCLAIMER', 'HOME', 'INICIO', 'INICIO',
        'LOGIN', 'REGISTER', 'SUBSCRIBE', 'SETTINGS', 'CONFIG', 'CONFIGURACAO',
        'BACK', 'VOLTAR', 'RETURN', 'MENU', 'SEARCH', 'BUSCAR'
    ];

    const FOOTER_TERMS = ['terms', 'termos', 'privacy', 'privacidade', 'policy', 'politica', 'politica',
        'contact', 'contato', 'about', 'sobre', 'help', 'ajuda', 'faq', 'support', 'suporte',
        'copyright', 'direitos', 'dmca', 'disclaimer', 'cookie', 'cookies', 'home', 'inicio', 'INICIAR BYPASS'];

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

    function scoreMatch(deobf) {
        if (!deobf || deobf.length < 2) return { score: 0, pct: 0, keyword: '' };

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
                var ratio = deobf.length / kw.length;
                score = 0.94 * ratio;
            } else if (deobf.indexOf(kw) !== -1) {
                score = 0.98;
            } else {
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
            .replace(/[_\-\.\u00B7\u2022]+/g, ' ')
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

        filtered.sort(function (a, b) { return a.length - b.length; });
        return filtered[0] || '';
    }

    function scanButtons() {
        var selectors = 'button, a, input[type="button"], input[type="submit"], [role="button"], [onclick], [class*="button"], [class*="btn"]';
        var elements = [];

        document.querySelectorAll(selectors).forEach(function (el) {
            if (isInFooter(el)) return;

            var raw = getElementSearchText(el);
            if (!raw || raw.length < 2 || raw.length > 100) return;
            if (isFooterText(raw)) return;

            var deobf = deobfuscate(raw);
            var match = scoreMatch(deobf);
            console.log('RAW: ' + raw + '; DEOBF: ' + deobf + '; ' + match.pct + '%');
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
                } catch (e) { }
            }

            var childPenalty = el.children.length > 3 ? -0.04 : 0;

            var finalScore = Math.min(1.0, Math.max(0, match.score + typeBonus + posBonus + hrefBonus + childPenalty));

            console.log('Score: ' + finalScore);

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

    function enableButton(el) {
        if (!el) return;
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        var disabledClasses = ['disabled', 'btn-disabled', 'button-disabled', 'is-disabled', 'inactive', 'not-active'];
        var cls = (el.className || '').toLowerCase();
        for (var i = 0; i < disabledClasses.length; i++) {
            if (cls.indexOf(disabledClasses[i]) !== -1) {
                el.classList.remove(disabledClasses[i]);
            }
        }
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('cursor', 'pointer', 'important');
        if (typeof el.onclick === 'function' && el.onclick.toString().indexOf('disabled') !== -1) {
            el.onclick = null;
        }
    }

    // ===== FUNCOES DE DETECAO DE FASE POR TEXTO NA PAGINA =====
    function detectPhaseFromPageText() {
        var bodyText = document.body ? document.body.innerText : '';
        var match = bodyText.match(/(\d+)\s*[/\-]\s*(\d+)/);
        if (match) {
            return { current: parseInt(match[1], 10), total: parseInt(match[2], 10), text: match[0] };
        }
        var allElements = document.querySelectorAll('*');
        for (var i = 0; i < Math.min(allElements.length, 200); i++) {
            var el = allElements[i];
            var text = el.innerText || el.textContent || '';
            var m = text.match(/(\d+)\s*[/\-]\s*(\d+)/);
            if (m) {
                var style = window.getComputedStyle(el);
                var isProminent = parseFloat(style.fontSize) >= 14 ||
                    style.fontWeight === 'bold' ||
                    parseInt(style.zIndex) > 0 ||
                    el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3';
                if (isProminent || i < 50) {
                    return { current: parseInt(m[1], 10), total: parseInt(m[2], 10), text: m[0] };
                }
            }
        }
        return null;
    }

    // ===== FUNCOES DE IFRAME DO ANUNCIO =====
    const AD_HELP_KEYWORDS = [
        'about', 'sobre', 'info', 'informa', 'privacy', 'privacidade', 'policy', 'politica',
        'why this ad', 'por que este anuncio', 'anuncio do google', 'google ads', 'report',
        'denunciar', 'fechar', 'close', '\u00D7', 'x', '\u2715', '\u2716', 'dismiss', 'remover',
        'learn more', 'saiba mais', 'opt out', 'choices', 'preferencias', 'preferences',
        'adchoices', 'ad choices', 'anuncios do google', 'powered by'
    ];

    function isAdHelpButton(el, iframeRect) {
        var rect = el.getBoundingClientRect();
        var relX = rect.left - iframeRect.left;
        var relY = rect.top - iframeRect.top;
        var relRight = iframeRect.right - rect.right;
        var relBottom = iframeRect.bottom - rect.bottom;
        var isSmall = rect.width <= 50 && rect.height <= 50;
        var isInCorner = (relX <= 10 || relRight <= 10) && (relY <= 10 || relBottom <= 10);
        var text = (el.innerText || el.getAttribute('aria-label') || el.title || '').toLowerCase().trim();
        var hasHelpText = false;
        for (var i = 0; i < AD_HELP_KEYWORDS.length; i++) {
            if (text.indexOf(AD_HELP_KEYWORDS[i]) !== -1) { hasHelpText = true; break; }
        }
        if (isSmall && isInCorner) return true;
        if (hasHelpText) return true;
        return false;
    }

    function getAdIframeButtons(iframe) {
        var buttons = [];
        var iframeRect = iframe.getBoundingClientRect();
        try {
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body) {
                var allClickables = doc.querySelectorAll('a, button, [role="button"], [onclick], input[type="button"], input[type="submit"], [class*="btn"], [class*="button"]');
                console.log('[GS] iframe DOM acessivel, encontrados ' + allClickables.length + ' elementos clicaveis');
                for (var i = 0; i < allClickables.length; i++) {
                    var el = allClickables[i];
                    if (isAdHelpButton(el, iframeRect)) {
                        console.log('[GS] Descartado botao de ajuda: ' + (el.innerText || el.tagName));
                        continue;
                    }
                    var elRect = el.getBoundingClientRect();
                    buttons.push({
                        text: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim(),
                        x: Math.round(iframeRect.left + elRect.left + elRect.width / 2),
                        y: Math.round(iframeRect.top + elRect.top + elRect.height / 2),
                        width: Math.round(elRect.width),
                        height: Math.round(elRect.height),
                        fromDOM: true
                    });
                }
            }
        } catch (e) {
            console.log('[GS] iframe cross-origin, nao conseguiu acessar DOM interno: ' + e.message);
        }
        return buttons;
    }

    function highlightIframeButton(btn, color, duration) {
        var hl = document.createElement('div');
        hl.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;' +
            'left:' + (btn.x - btn.width / 2 - 4) + 'px;' +
            'top:' + (btn.y - btn.height / 2 - 4) + 'px;' +
            'width:' + (btn.width + 8) + 'px;height:' + (btn.height + 8) + 'px;' +
            'border:3px solid ' + color + ';border-radius:4px;' +
            'background:' + color + '22;box-shadow:0 0 10px ' + color + ';' +
            'transition:opacity 0.3s;';
        hl.className = 'gs-iframe-btn-highlight';
        document.body.appendChild(hl);
        if (duration > 0) {
            setTimeout(function () {
                hl.style.opacity = '0';
                setTimeout(function () { if (hl.parentNode) hl.parentNode.removeChild(hl); }, 300);
            }, duration);
        }
        return hl;
    }

    function removeAllIframeHighlights() {
        var hls = document.querySelectorAll('.gs-iframe-btn-highlight');
        for (var i = 0; i < hls.length; i++) {
            if (hls[i].parentNode) hls[i].parentNode.removeChild(hls[i]);
        }
    }

    function findNearestAd(targetEl) {
        var containers = document.querySelectorAll('.ad-container');
        console.log('[GS] .ad-container encontrados:', containers.length);
        var candidates = [];
        for (var c = 0; c < containers.length; c++) {
            var ifr = containers[c].querySelector('iframe');
            if (ifr) { candidates.push(ifr); } else { candidates.push(containers[c]); }
        }
        if (candidates.length === 0) {
            var allIframes = document.querySelectorAll('iframe');
            for (var i = 0; i < allIframes.length; i++) {
                var src = (allIframes[i].src || '').toLowerCase();
                var parent = allIframes[i].parentElement;
                var parentCls = parent ? (parent.className || '').toLowerCase() : '';
                if (src.indexOf('google') !== -1 || src.indexOf('doubleclick') !== -1 || parentCls.indexOf('ad') !== -1) {
                    candidates.push(allIframes[i]);
                }
            }
        }
        if (candidates.length === 0) {
            console.log('[GS] Nenhum anuncio/iframe encontrado');
            return null;
        }
        var targetRect = targetEl.getBoundingClientRect();
        var targetCX = targetRect.left + targetRect.width / 2;
        var targetCY = targetRect.top + targetRect.height / 2;
        var best = null; var bestDist = Infinity;
        for (var i = 0; i < candidates.length; i++) {
            var ad = candidates[i];
            if (ad === targetEl) continue;
            if (ad.contains && ad.contains(targetEl)) continue;
            if (targetEl.contains && targetEl.contains(ad)) continue;
            var adRect = ad.getBoundingClientRect();
            if (adRect.width === 0 || adRect.height === 0) continue;
            var adCX = adRect.left + adRect.width / 2;
            var adCY = adRect.top + adRect.height / 2;
            var dx = targetCX - adCX; var dy = targetCY - adCY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) { bestDist = dist; best = ad; }
        }
        if (best) {
            console.log('[GS] Elemento mais proximo:', best.tagName, best.className || best.id || '', 'dist:', Math.round(bestDist));
        }
        return (best && bestDist < 600) ? best : null;
    }

    function highlightAd(el, duration) {
        if (!el) return;
        el.classList.add('gs-ad-highlight');
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) { }
        if (duration > 0) {
            setTimeout(function () {
                try { el.classList.remove('gs-ad-highlight'); } catch (e) { }
            }, duration);
        }
    }

    function removeAdHighlight(el) {
        if (!el) return;
        try { el.classList.remove('gs-ad-highlight'); } catch (e) { }
    }

    // NOVO: Gera coordenadas de clique no anuncio (sem depender de botoes)
    function generateAdClickCoordinates() {
        var coords = [];

        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            var iframe = iframes[i];
            var rect = iframe.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 50) continue;

            var src = (iframe.src || '').toLowerCase();
            var parent = iframe.parentElement;
            var parentCls = parent ? (parent.className || '').toLowerCase() : '';
            var isAd = src.indexOf('google') !== -1 ||
                src.indexOf('doubleclick') !== -1 ||
                src.indexOf('ads') !== -1 ||
                parentCls.indexOf('ad') !== -1 ||
                parentCls.indexOf('ads') !== -1;

            if (isAd || rect.width > 200 || rect.height > 100) {
                coords.push({
                    x: Math.round(rect.left + rect.width / 2),
                    y: Math.round(rect.top + rect.height / 2),
                    label: 'iframe-center',
                    source: 'iframe'
                });
                var cols = 3, rows = 2;
                for (var r = 0; r < rows; r++) {
                    for (var c = 0; c < cols; c++) {
                        coords.push({
                            x: Math.round(rect.left + rect.width * (c + 0.5) / cols),
                            y: Math.round(rect.top + rect.height * (r + 0.5) / rows),
                            label: 'iframe-grid-' + r + '-' + c,
                            source: 'iframe-grid'
                        });
                    }
                }
            }
        }

        var adSelectors = [
            '.ad-container', '[class*="ad"]', '[id*="ad"]',
            '.adsbygoogle', '.advertisement', '.banner',
            '[data-ad-slot]', '[data-ad-client]'
        ];
        for (var s = 0; s < adSelectors.length; s++) {
            var els = document.querySelectorAll(adSelectors[s]);
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                var rect = el.getBoundingClientRect();
                if (rect.width < 30 || rect.height < 30) continue;
                coords.push({
                    x: Math.round(rect.left + rect.width / 2),
                    y: Math.round(rect.top + rect.height / 2),
                    label: 'ad-container-center',
                    source: 'ad-container'
                });
            }
        }

        var w = window.innerWidth;
        var h = window.innerHeight;

        coords.push({ x: Math.round(w / 2), y: Math.round(h / 2), label: 'screen-center', source: 'generic' });
        coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.15), label: 'top-center', source: 'generic' });
        coords.push({ x: Math.round(w * 0.25), y: Math.round(h * 0.15), label: 'top-left', source: 'generic' });
        coords.push({ x: Math.round(w * 0.75), y: Math.round(h * 0.15), label: 'top-right', source: 'generic' });
        coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.4), label: 'mid-center', source: 'generic' });
        coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.4), label: 'mid-left', source: 'generic' });
        coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.4), label: 'mid-right', source: 'generic' });
        coords.push({ x: Math.round(w / 2), y: Math.round(h * 0.7), label: 'lower-center', source: 'generic' });
        coords.push({ x: Math.round(w * 0.3), y: Math.round(h * 0.7), label: 'lower-left', source: 'generic' });
        coords.push({ x: Math.round(w * 0.7), y: Math.round(h * 0.7), label: 'lower-right', source: 'generic' });

        return coords;
    }

    function scanAndReportAdButtons(adEl) {
        if (!adEl) {
            if (window.__GS_REPORT_AD_BUTTONS__) window.__GS_REPORT_AD_BUTTONS__([]);
            return;
        }
        highlightAd(adEl, 3000);
        if (adEl.tagName !== 'IFRAME') {
            var iframe = adEl.querySelector('iframe');
            if (iframe) { scanAndReportAdButtons(iframe); return; }
            var rect = adEl.getBoundingClientRect();
            if (window.__GS_REPORT_AD_BUTTONS__) {
                window.__GS_REPORT_AD_BUTTONS__([{
                    text: 'container-center',
                    x: Math.round(rect.left + rect.width / 2),
                    y: Math.round(rect.top + rect.height / 2),
                    width: Math.round(rect.width), height: Math.round(rect.height), fromDOM: false
                }]);
            }
            return;
        }
        console.log('[GS] Alvo eh IFRAME, buscando botoes internos...');
        var buttons = getAdIframeButtons(adEl);
        console.log('[GS] Botoes candidatos no iframe:', buttons.length);
        for (var i = 0; i < buttons.length; i++) {
            highlightIframeButton(buttons[i], '#22c55e', 3000);
            console.log('[GS] Botao #' + i + ':', buttons[i].text, 'pos:', buttons[i].x, buttons[i].y);
        }
        if (window.__GS_REPORT_AD_BUTTONS__) {
            window.__GS_REPORT_AD_BUTTONS__(buttons);
        }
    }

    // ===== CONTAGEM REGRESSIVA =====
    function countdown(seconds, label, onTick, onDone) {
        var remaining = seconds;
        addFeedback('<span class="warn">\u23F3 ' + label + ' ' + remaining + 's</span>');
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
        try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch (e) { }
        if (duration > 0) {
            setTimeout(function () {
                try { el.classList.remove('gs-highlight'); } catch (e) { }
            }, duration);
        }
    }

    function removeHighlight(el) {
        if (!el) return;
        try { el.classList.remove('gs-highlight'); } catch (e) { }
    }

    // ===== CLICK COM TIMEOUT DE PROTECAO =====
    function smartClick(item, onComplete) {
        if (!item || !item.el) {
            if (onComplete) onComplete(false);
            return false;
        }

        var el = item.el;
        var startUrl = location.href;
        var clicked = false;

        enableButton(el);
        highlightElement(el, 2000);

        ['mousedown', 'mouseup', 'click'].forEach(function (type) {
            try {
                var ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                el.dispatchEvent(ev);
            } catch (e) { }
        });

        try {
            el.click();
            clicked = true;
        } catch (e) {
            removeHighlight(el);
            if (onComplete) onComplete(false);
            return false;
        }

        if (el.tagName === 'A' && el.href) {
            setTimeout(function () {
                if (!window.__GS_STOP_NAV__) {
                    try { location.href = el.href; } catch (e) { }
                }
            }, 300);
        }

        setTimeout(function () {
            removeHighlight(el);
            if (onComplete) {
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
                <button id="gs-close" type="button" aria-label="Fechar">\u2715</button>
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
                    <button id="gs-eye" type="button">\uD83D\uDC41</button>
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
        if (statusElement) statusElement.textContent = state.status || "Obtendo sessao...";
    }

    function attachEvents() {
        if (!overlay) return;
        if (logoImage) {
            logoImage.onerror = function () {
                if (logoContainer) {
                    logoContainer.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a0a0a;font-size:24px;">\u2694\uFE0F</div>';
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
                eyeButton.textContent = input.type === "password" ? "\uD83D\uDC41" : "\uD83D\uDE48";
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
            .catch(function (error) { console.error("[GS] session error:", error); updateStatus("Erro ao obter sessao"); callback(null); });
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
                try { body = JSON.parse(text); } catch (error) { console.warn("[GS] Resposta nao JSON:", text); callback(null); return; }
                const destination = body?.[0]?.result?.data?.json?.destinationLink;
                callback(typeof destination === "string" ? destination : null);
            })
            .catch(function (error) { console.error("[GS] nextStage error:", error); callback(null); });
    }

    // ===== INTERACAO COM A PAGINA =====
    // MODIFICADO: Delega clique no anuncio para o Electron via coordenadas
    // Nao detecta mais botoes — so reporta coordenadas para o Electron clicar
    function interactWithPage(callback) {
        var buttons = scanButtons();

        if (buttons.length === 0) {
            addFeedback('<span class="warn">\u26A0 Nenhum botao de avanco encontrado</span>');
            if (callback) callback(false);
            return false;
        }

        var best = buttons[0];
        addFeedback('<span class="ok">\u2713 Botao: "' + best.text.substring(0, 30) + '" [deobf: ' + best.deobf + '] (score ' + best.pct + '%)</span>');

        var maxCycles = 4;
        var cycle = 0;

        function runCycle() {
            if (manuallyClosed) { if (callback) callback(false); return; }
            cycle++;
            if (cycle > maxCycles) {
                addFeedback('<span class="err">\u2717 Maximo de ' + maxCycles + ' ciclos atingido</span>');
                if (callback) callback(false);
                return;
            }

            var fresh = scanButtons();
            var target = (fresh.length > 0) ? fresh[0] : best;

            var ad = findNearestAd(target.el);

            if (ad) {
                addFeedback('<span class="warn">\uD83C\uDFAF Ciclo #' + cycle + ' — Anuncio encontrado, reportando coordenadas...</span>');
                // NOVO: Reporta coordenadas para o Electron clicar
                var coords = generateAdClickCoordinates();
                if (coords.length > 0) {
                    addFeedback('<span class="ok">\u2713 ' + coords.length + ' coordenadas geradas para clique</span>');
                    if (window.__GS_REPORT_AD_COORDS__) {
                        window.__GS_REPORT_AD_COORDS__(coords);
                    }
                }
                scanAndReportAdButtons(ad);

                // Aguarda o Electron processar o clique
                var adClickResolved = false;
                var checkInterval = setInterval(function () {
                    if (adClickResolved || manuallyClosed) {
                        clearInterval(checkInterval);
                        return;
                    }
                    // Verifica se URL mudou (sinal de que o Electron clicou e funcionou)
                    var currentUrl = location.href;
                    var destHost = '';
                    try { destHost = new URL(currentUrl).hostname.toLowerCase(); } catch (e) { }
                    if (!isSupportedHost(destHost) && currentUrl !== 'about:blank') {
                        adClickResolved = true;
                        clearInterval(checkInterval);
                        addFeedback('<span class="ok">\u2713 Anuncio clicado com sucesso pelo Electron!</span>');
                        if (callback) callback(true);
                        return;
                    }
                }, 1000);

                // Timeout de seguranca
                setTimeout(function () {
                    if (!adClickResolved) {
                        clearInterval(checkInterval);
                        adClickResolved = true;
                        addFeedback('<span class="warn">\u26A0 Anuncio nao abriu — tentando botao direto</span>');
                        tryButtonClick(target, function (worked) {
                            if (worked) {
                                if (callback) callback(true);
                            } else {
                                setTimeout(runCycle, 1000);
                            }
                        });
                    }
                }, 8000);
            } else {
                addFeedback('<span class="warn">\u26A0 Sem anuncio proximo — tentando botao direto</span>');
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
        updateStatus('Clicando em botao de avanco...');
        smartClick(target, function (urlChanged) {
            if (urlChanged) {
                addFeedback('<span class="ok">\u2713 Botao funcionou!</span>');
                if (callback) callback(true);
            } else {
                addFeedback('<span class="warn">\u26A0 Clique no botao nao gerou navegacao</span>');
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
            updateStatus("Sessao invalida");
            addFeedback('<span class="err">\u2717 Sessao invalida</span>');
            console.error("[GS] Sessao invalida:", session);
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

        const fb = overlay?.querySelector("#gs-feedback");
        if (fb) fb.innerHTML = "";

        let progress = initialStage + 1;

        function next() {
            if (manuallyClosed) return;

            const visibleStage = Math.min(progress, totalStages);
            updateStage(visibleStage, totalStages);
            addFeedback('\u25B6 Chamando API (fase ' + visibleStage + '/' + totalStages + ')');

            callNextStage(token, stageId, progress, function (destination) {
                if (manuallyClosed) return;

                var clicked = false;
                var interactionDone = false;

                interactWithPage(function (didClick) {
                    clicked = didClick;
                    interactionDone = true;
                });

                if (typeof destination === "string" && /^https?:\/\//i.test(destination)) {
                    addFeedback('<span class="ok">\u2713 API retornou link</span>');

                    try {
                        const destHost = new URL(destination).hostname.toLowerCase();
                        if (!isSupportedHost(destHost)) {
                            addFeedback('<span class="ok">\u2713 Link final detectado!</span>');
                            // NOVO: Guarda URL final no state
                            setState({ finalUrl: destination, completed: true });
                            redirectToFinalUrl(destination);
                            return;
                        }
                    } catch (e) { }

                    addFeedback('\u21BB Redirecionando para proxima fase...');
                    var waitTime = clicked ? CLICK_DELAY + 1000 : 1000;
                    setTimeout(function () {
                        location.replace(destination);
                    }, waitTime);
                    return;
                }

                var fallbackTimer = setInterval(function () {
                    if (interactionDone || manuallyClosed) {
                        clearInterval(fallbackTimer);
                        if (manuallyClosed) return;

                        if (!clicked) {
                            addFeedback('<span class="err">\u2717 API nao retornou link e botao nao funcionou</span>');
                            updateStatus("API sem resposta — tentando fallback...");

                            setTimeout(function () {
                                if (manuallyClosed) return;
                                interactWithPage(function (retryOk) {
                                    if (!retryOk) {
                                        addFeedback('<span class="err">\u2717 Fallback falhou</span>');
                                    }
                                });
                            }, 1500);

                            if (progress < totalStages + 1) {
                                progress++;
                                addFeedback('\u23F3 Aguardando ' + (CLICK_DELAY / 1000) + 's antes da proxima fase...');
                                setTimeout(next, CLICK_DELAY);
                            }
                        } else {
                            if (progress < totalStages + 1) {
                                progress++;
                                addFeedback('\u23F3 Aguardando ' + (CLICK_DELAY / 1000) + 's antes da proxima fase...');
                                setTimeout(next, CLICK_DELAY);
                            }
                        }
                    }
                }, 500);

                setTimeout(function () {
                    clearInterval(fallbackTimer);
                    if (!interactionDone && !manuallyClosed && progress < totalStages + 1) {
                        progress++;
                        addFeedback('\u23F3 Safety: aguardando ' + (CLICK_DELAY / 1000) + 's...');
                        setTimeout(next, CLICK_DELAY);
                    }
                }, 35000);

                return;

                if (progress < totalStages + 1) {
                    progress++;
                    addFeedback('\u23F3 Aguardando ' + (CLICK_DELAY / 1000) + 's antes da proxima fase...');
                    setTimeout(next, CLICK_DELAY);
                    return;
                }

                bypassRunning = false; startedThisPage = false;
                setState({ active: false, running: false, currentStage: null, totalStages: null, status: "Nao foi possivel concluir" });
                showIdleUI();
                addFeedback('<span class="err">\u2717 Nao foi possivel concluir</span>');
                if (errorElement) errorElement.textContent = "Nao foi possivel concluir.";
            });
        }
        next();
    }

    function runBypass() {
        if (startedThisPage) return;
        startedThisPage = true;
        showBypassUI();
        updateStatus("Obtendo sessao...");
        getSessionInfo(function (session) {
            if (!session) { startedThisPage = false; showIdleUI(); return; }
            processAllStages(session);
        });
    }

    function startNewBypass() {
        manuallyClosed = false; startedThisPage = false; bypassRunning = false;
        clearState();
        setState({ active: true, running: false, dismissed: false, completed: false, currentStage: null, totalStages: null, finalUrl: null, status: "Obtendo sessao..." });
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
        addFeedback('<span class="ok">\u2713 DESTINO: ' + url.substring(0, 50) + '...</span>');
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
        console.log("[GS] v6 + Motor v6 (URL final + coordenadas) ativo em:", location.origin);
    }

    if (document.documentElement) { initialize(); }
    else {
        const initObserver = new MutationObserver(function () {
            if (document.documentElement) { initObserver.disconnect(); initialize(); }
        });
        initObserver.observe(document, { childList: true, subtree: true });
    }
})();